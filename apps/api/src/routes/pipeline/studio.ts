/**
 * F5 Studio — pipeline routes.
 *
 * Scope of this first pass:
 * - analyze       : fully wired (Claude Script Director / YouTube Improver)
 * - generate-all  : creates a job, marks scenes as 'generating', triggers
 *                   HeyGen/Remotion/Pexels per type. Remotion + Pexels
 *                   calls are stubbed — marked TODO(F5).
 * - regenerate    : wired for 'avatar' (HeyGen only); others stubbed.
 * - reorder       : fully wired.
 * - add-scene     : fully wired (Claude suggests type if omitted).
 * - delete        : fully wired.
 * - avatars       : real HeyGen listing.
 * - render-final  : stubbed (FFmpeg concat pipeline is a P2 item).
 */

import { Router } from 'express'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { memoizeTTL } from '../../lib/memoize-ttl'
import { detectLanguage, type DetectedLanguage } from '../../lib/detect-language'
import {
  creditCostForVideo,
  deductCredits,
  refundCredits,
  InsufficientCreditsError,
} from '../../services/credits'

// ── Studio cost model ────────────────────────────────────────────────────
//
// Studio combines several renderers per video. Each scene type lands at
// a different cost tier from the shared per-minute rate map:
//
//   avatar / split       → 'pro'        (HeyGen avatar = premium)
//   infographic / demo   → 'fast'       (Remotion render, mid-cost)
//   typography           → 'fast'
//   broll                → 'storyboard' (Pexels stock = cheapest)
//
// The total Studio cost is the sum of per-scene costs computed from each
// scene's estimated duration. Falls back to 'fast' when the type is
// unknown (defensive — no scene type should be missing from the map).
const STUDIO_SCENE_TIERS: Record<string, 'pro' | 'fast' | 'storyboard'> = {
  avatar:      'pro',
  split:       'pro',
  infographic: 'fast',
  demo:        'fast',
  typography:  'fast',
  broll:       'storyboard',
}

interface StudioSceneRow {
  id:           string
  type:         string
  duration_est: number | null
}

function studioBatchCost(scenes: StudioSceneRow[]): number {
  let total = 0
  for (const s of scenes) {
    const tier = STUDIO_SCENE_TIERS[s.type] ?? 'fast'
    const seconds = Math.max(3, s.duration_est ?? 8)
    total += creditCostForVideo(seconds, tier)
  }
  return total
}
import {
  F5_SCRIPT_DIRECTOR_SYSTEM,
  F5_YOUTUBE_IMPROVER_SYSTEM,
  F5_SCENE_REWRITER_SYSTEM,
  type ScriptDirectorResponse,
  type YoutubeImproverResponse,
  type SceneRewriterResponse,
} from '../../services/claude-prompts/f5'
import {
  generateAvatarScene,
  getVideoStatus,
  listAvatars,
} from '../../services/heygen'
import { generateVoiceoverWithTimestamps } from '../../services/elevenlabs'
import { transcribeYouTube, isValidYouTubeUrl } from '../../services/transcribe'
import { assembleStudioVideo, type StudioSceneClip } from '../../services/ffmpeg'
import { composeAvatarSceneWithHyperframes, isHyperframesEnabled } from '../../services/hyperframes'
import { renderMotionVideo } from '../../services/remotion'

// Scene types rendered by Remotion (not HeyGen)
const REMOTION_SCENE_TYPES = new Set(['infographic', 'broll', 'demo', 'typography'])

// Map studio scene type → Remotion scene_type layout
const REMOTION_SCENE_TYPE_MAP: Record<string, 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'> = {
  infographic: 'stats_counter',
  broll:       'image_full',
  demo:        'product_showcase',
  typography:  'text_hero',
}

export const studioRouter = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Constants ───────────────────────────────────────────────────────────

// Rachel — ElevenLabs premade voice available on every account plan.
// Used as a last-resort fallback when project.voice_id and
// ELEVENLABS_DEFAULT_VOICE_ID are missing or invalid.
const ELEVENLABS_FALLBACK_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

// ── Helpers ─────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  // 1. Try direct parse first (Claude sometimes returns clean JSON)
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed
  }

  // 2. Extract from fenced code block: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim()
  }

  // 3. Fallback: find the outermost { ... } in the response
  const objMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]

  throw new Error('No JSON object found in Claude response')
}

/**
 * Wrap any user prompt with an unambiguous output-language directive so
 * Claude doesn't translate to French (the F5 prompts are written in
 * French and that strongly biases Claude unless we explicitly counter it).
 * Inject the detected language at the TOP of the user message — Claude
 * weighs the most recent / first user-facing content most heavily.
 */
function withLanguageHeader(user: string, lang: DetectedLanguage): string {
  return `OUTPUT LANGUAGE — STRICT
All script text and on-screen copy fields (script, suggested_title, hook, cta, new_script, improved_script, infographic_data.title, etc.) MUST be written in ${lang.name} (${lang.code}). Do NOT translate to French or any other language regardless of the language used in the system prompt. The broll_query field is the ONLY exception — keep it in English (Pexels is English-only).

${user}`
}

async function callClaude<T>(
  system: string,
  user: string,
  label: string,
  lang?: DetectedLanguage,
): Promise<T> {
  const userWithLang = lang ? withLanguageHeader(user, lang) : user
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,  // 4096 was too low — long scripts with 8+ scenes hit the limit
    system,
    messages: [{ role: 'user', content: userWithLang }],
  })

  // Detect truncation: if finish_reason is 'max_tokens' the response is cut off
  const stopReason = message.stop_reason
  const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''

  if (stopReason === 'max_tokens') {
    logger.error({ label, rawLength: raw.length }, 'Claude response truncated at max_tokens — JSON will be incomplete')
    throw new Error(`Claude ${label} response was truncated (too long) — try a shorter script`)
  }

  try {
    return JSON.parse(extractJson(raw)) as T
  } catch (err) {
    logger.error({ err, raw: raw.slice(0, 800), label, stopReason }, 'Claude JSON parse failed')
    throw new Error(`Claude ${label} returned invalid JSON`)
  }
}

// ── ElevenLabs audio helper with voice-fallback ─────────────────────────
// Tries the configured voice first; if it fails with a voice-validation error
// (invalid/inaccessible voice ID), retries once with the premade fallback so
// the pipeline never stalls on a misconfigured voice setting.

async function generateAudioWithFallback(
  text: string,
  voiceId: string,
  label: string,
): Promise<Buffer> {
  try {
    const { audioBuffer } = await generateVoiceoverWithTimestamps(text, voiceId)
    return audioBuffer
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // ElevenLabs returns "Voice validation failed" when the voice_id is
    // unknown / not on the account. Fall back to Rachel automatically.
    if (msg.toLowerCase().includes('voice validation') || msg.includes('404') || msg.includes('voice_not_found')) {
      logger.warn({ voiceId, label, msg }, 'generateAudioWithFallback: voice invalid, retrying with Rachel fallback')
      const { audioBuffer } = await generateVoiceoverWithTimestamps(text, ELEVENLABS_FALLBACK_VOICE_ID)
      return audioBuffer
    }
    throw err
  }
}

// ── Polling helper ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000   // 15 seconds between polls
const POLL_TIMEOUT_MS  = 600_000  // 10 minutes max

async function pollUntilDone(sceneId: string, heygenVideoId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    let status: Awaited<ReturnType<typeof getVideoStatus>>
    try {
      status = await getVideoStatus(heygenVideoId)
    } catch (err) {
      logger.warn({ err, sceneId, heygenVideoId }, 'pollUntilDone: getVideoStatus failed, will retry')
      continue
    }

    logger.info({ sceneId, heygenVideoId, status: status.status }, 'pollUntilDone: tick')

    if (status.status === 'completed') {
      await supabaseAdmin.from('studio_scenes').update({
        status:        'done',
        video_url:     status.video_url ?? null,
        thumbnail_url: status.thumbnail_url ?? null,
        duration_actual: status.duration ?? null,
      }).eq('id', sceneId)
      return
    }

    if (status.status === 'failed') {
      await supabaseAdmin.from('studio_scenes').update({
        status:        'error',
        error_message: status.error?.message ?? 'HeyGen reported failure',
      }).eq('id', sceneId)
      return
    }
    // status === 'processing' | 'pending' → keep waiting
  }

  // Timed out
  await supabaseAdmin.from('studio_scenes').update({
    status:        'error',
    error_message: 'HeyGen generation timed out after 10 minutes',
  }).eq('id', sceneId)
}

// ── POST /analyze ───────────────────────────────────────────────────────

const analyzeSchema = z.object({
  inputType: z.enum(['script', 'youtube_url']),
  value:     z.string().min(5).max(20_000),
  language:  z.string().min(2).max(5).default('fr'),
  title:     z.string().max(120).optional(),
  avatarId:  z.string().optional(),
  voiceId:   z.string().optional(),
  format:    z.enum(['16_9', '9_16', 'both']).default('16_9'),
  // ── HyperFrames enrichment (Phase B) ──────────────────────────────────
  // When true, each scene's HeyGen MP4 gets wrapped in a HyperFrames
  // composition (lower-third, brand color, vignette) before final concat.
  // Defaults to false — opt-in per project. The worker also reads
  // ENRICH_AVATAR_WITH_HYPERFRAMES env var as a master kill-switch :
  // env=false disables HF for all projects regardless of project flag.
  useHyperframes:        z.boolean().optional(),
  /** Optional template name. Default 'avatar-lower-third'. */
  hyperframesTemplate:   z.enum([
    'avatar-lower-third',
    'avatar-intro-card',
    'avatar-pip',
    'avatar-tiktok',
    'avatar-instagram',
    'avatar-logo-outro',
  ]).optional(),
  /** Brand primary color for HF lower-third. Falls back to
   *  background_color, then to CLYRO blue (#3B8EF0). */
  brandColor:            z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

studioRouter.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const parsed = analyzeSchema.parse(req.body)

    // 1. Normalize the script
    let originalScript = parsed.value
    let improvedScript: string | null = null

    if (parsed.inputType === 'youtube_url') {
      if (!isValidYouTubeUrl(parsed.value)) {
        res.status(400).json({ error: 'Invalid YouTube URL', code: 'INVALID_URL' })
        return
      }
      // Stage 1: transcribe (may throw if yt-dlp not installed)
      const transcript = await transcribeYouTube(parsed.value)
      originalScript = transcript.transcript

      // Stage 2: Claude improves the raw transcript — use the language of
      // the actual transcript content, not the user-supplied default.
      const ytLang = detectLanguage(originalScript)
      const improved = await callClaude<YoutubeImproverResponse>(
        F5_YOUTUBE_IMPROVER_SYSTEM,
        `Raw transcript:\n\n${originalScript}`,
        'youtube_improver',
        ytLang,
      )
      improvedScript = improved.improved_script
    }

    // 2. Claude Script Director splits into typed scenes
    const scriptToDirect = improvedScript ?? originalScript
    // Detect from the actual content; falls back to 'en' if undecidable.
    // This overrides the request's `language` field, which used to default
    // to 'fr' and silently translate non-French scripts.
    const detectedLang = detectLanguage(scriptToDirect)
    logger.info({ language: detectedLang.code, requestLanguage: parsed.language }, 'Studio language detected')
    const directed = await callClaude<ScriptDirectorResponse>(
      F5_SCRIPT_DIRECTOR_SYSTEM,
      `Script:\n\n${scriptToDirect}`,
      'script_director',
      detectedLang,
    )

    // 3. Create project + scenes in Supabase
    // HyperFrames per-project options stored in `metadata` JSON to avoid
    // a schema migration. The render-final endpoint reads them back.
    const projectMetadata: Record<string, unknown> = {}
    if (parsed.useHyperframes !== undefined)      projectMetadata.use_hyperframes = parsed.useHyperframes
    if (parsed.hyperframesTemplate)               projectMetadata.hyperframes_template = parsed.hyperframesTemplate
    if (parsed.brandColor)                        projectMetadata.brand_color = parsed.brandColor

    const { data: project, error: pErr } = await supabaseAdmin
      .from('studio_projects')
      .insert({
        user_id:        req.userId,
        title:          parsed.title ?? directed.suggested_title ?? 'New project',
        input_type:     parsed.inputType,
        input_value:    parsed.value,
        input_language: parsed.language,
        original_script: originalScript,
        improved_script: improvedScript,
        avatar_id:      parsed.avatarId ?? null,
        voice_id:       parsed.voiceId ?? null,
        format:         parsed.format,
        status:         'editing',
        // metadata column may not exist on all schemas; spread when non-empty
        // so existing rows aren't impacted. Postgres ignores unknown keys via
        // the supabase client when the column is jsonb.
        ...(Object.keys(projectMetadata).length > 0 ? { metadata: projectMetadata } : {}),
      })
      .select()
      .single()

    if (pErr || !project) {
      logger.error({ err: pErr }, 'Failed to create studio project')
      res.status(500).json({ error: 'Failed to create project', code: 'DB_ERROR' })
      return
    }

    const scenesToInsert = directed.scenes.map((s) => ({
      project_id:  project.id,
      user_id:     req.userId,
      index:       s.index,
      type:        s.type,
      script:      s.script,
      duration_est: s.duration_est,
      status:     'generating' as const,
      broll_query: s.broll_query ?? null,
      remotion_params: s.infographic_data
        ? { chartType: s.infographic_data.chart_type, title: s.infographic_data.title, data: s.infographic_data.data, hint: s.remotion_hint }
        : s.remotion_hint ? { hint: s.remotion_hint } : null,
    }))

    const { error: sErr } = await supabaseAdmin
      .from('studio_scenes')
      .insert(scenesToInsert)

    if (sErr) {
      logger.error({ err: sErr }, 'Failed to insert scenes — rolling back project')
      await supabaseAdmin.from('studio_projects').delete().eq('id', project.id)
      res.status(500).json({ error: 'Failed to create scenes', code: 'DB_ERROR' })
      return
    }

    res.status(201).json({
      projectId: project.id,
      suggestedTitle: directed.suggested_title,
      totalDurationEst: directed.total_duration_est,
      sceneCount: directed.scenes.length,
    })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'studio.analyze failed')
    const msg = err instanceof Error ? err.message : 'Analyze failed'
    res.status(500).json({ error: msg, code: 'INTERNAL_ERROR' })
  }
})

// ── POST /generate-all ──────────────────────────────────────────────────

studioRouter.post('/generate-all', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId?: string }
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return }

    // Ownership + fetch
    const { data: project, error: pErr } = await supabaseAdmin
      .from('studio_projects').select('*')
      .eq('id', projectId).eq('user_id', req.userId)
      .single()
    if (pErr || !project) { res.status(404).json({ error: 'Project not found' }); return }

    const { data: scenes } = await supabaseAdmin
      .from('studio_scenes').select('*')
      .eq('project_id', projectId).order('index', { ascending: true })

    // ── Credit deduction (atomic) ─────────────────────────────────────
    // Compute the total cost from each scene's type + estimated duration
    // BEFORE flipping the project to "generating". If the user can't
    // afford the batch we surface 402 and don't burn any state.
    //
    // Keep the row type wide here (the IIFE below reads many extra
    // columns: script, remotion_params, index, …); studioBatchCost only
    // touches the three fields it needs.
    const sceneList = scenes ?? []
    const creditCost = studioBatchCost(sceneList as StudioSceneRow[])
    if (creditCost > 0) {
      try {
        await deductCredits(req.userId!, creditCost, `studio_project:${projectId}`, {
          projectId,
          sceneCount: sceneList.length,
          breakdown: sceneList.map((s) => ({
            id: s.id,
            type: s.type,
            duration: s.duration_est,
            tier: STUDIO_SCENE_TIERS[s.type] ?? 'fast',
          })),
        })
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          res.status(402).json({
            error: 'Insufficient credits',
            code:  'INSUFFICIENT_CREDITS',
            required:  err.required,
            available: err.available,
            projectId,
          })
          return
        }
        throw err
      }
    }

    await supabaseAdmin.from('studio_projects').update({ status: 'generating' }).eq('id', projectId)

    // Fire-and-forget scene generation. Each type has its own pipeline.
    // NOTE(F5): Remotion + Pexels paths are stubbed for now — marked as
    // 'error' so the timeline UI shows them visibly and the user can retry.
    // Resolve the effective voice ID: prefer the one stored on the project,
    // fall back to the server default (ELEVENLABS_DEFAULT_VOICE_ID).
    // The Studio wizard has no voice picker yet — voice_id is often null.
    const effectiveVoiceId = project.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? ELEVENLABS_FALLBACK_VOICE_ID

    ;(async () => {
      // sceneList is declared in the outer scope (used by the cost-refund
      // logic below); just bail early if empty.
      if (sceneList.length === 0) return

      // Flip every scene to 'generating' up-front so the UI shows progress
      // immediately instead of waiting for audio pre-gen to reach each row.
      await supabaseAdmin
        .from('studio_scenes')
        .update({ status: 'generating' })
        .in('id', sceneList.map((s) => s.id))

      // Partition scenes by renderer type
      const avatarScenes = sceneList.filter(
        (s) => s.type === 'avatar' || s.type === 'split',
      )
      const remotionScenesList = sceneList.filter((s) => REMOTION_SCENE_TYPES.has(s.type))

      // Short-circuit: if the project has no avatar AND there are avatar-type
      // scenes, mark only those as error. Remotion scenes can proceed without
      // an avatar.
      if (!project.avatar_id && avatarScenes.length > 0) {
        await supabaseAdmin
          .from('studio_scenes')
          .update({
            status: 'error',
            error_message: 'No avatar configured on project — select an avatar before generating',
          })
          .in('id', avatarScenes.map((s) => s.id))
      }

      // Per-scene error tracker — any scene that fails in an earlier phase
      // is skipped in later phases and its row is updated with the error
      // message. This preserves the "one bad scene doesn't kill the batch"
      // guarantee we had in the sequential loop.
      const sceneErrors = new Map<string, string>()
      const markSceneError = async (sceneId: string, err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        sceneErrors.set(sceneId, msg)
        logger.error({ err, sceneId }, 'scene generation failed')
        await supabaseAdmin
          .from('studio_scenes')
          .update({ status: 'error', error_message: msg })
          .eq('id', sceneId)
      }

      // Pre-mark avatar scenes that are blocked (no avatar) so they don't
      // proceed to Phase 1 audio gen unnecessarily.
      if (!project.avatar_id) {
        for (const s of avatarScenes) sceneErrors.set(s.id, 'no avatar')
      }

      // ── Phase 1 — ElevenLabs audio pre-gen (ALL scenes) ───────────────
      // Sequential with 800ms guard to stay under ElevenLabs rate limit.
      // audioBuffers kept in memory for Remotion; audioUrls (signed) for HeyGen.
      const audioUrls    = new Map<string, string>()
      const audioBuffers = new Map<string, Buffer>()

      for (const scene of sceneList) {
        // Skip scenes already marked as errored (e.g. avatar scenes with no avatar)
        if (sceneErrors.has(scene.id)) continue

        if (!effectiveVoiceId) {
          await markSceneError(
            scene.id,
            new Error('Audio pre-generation failed — no voice configured'),
          )
          continue
        }

        try {
          const audioBuffer = await generateAudioWithFallback(
            scene.script,
            effectiveVoiceId,
            `scene-${scene.id}`,
          )

          // Keep buffer in memory for Remotion render
          audioBuffers.set(scene.id, audioBuffer)

          // Upload to voice-samples bucket — signed URL is only needed for HeyGen scenes
          if (!REMOTION_SCENE_TYPES.has(scene.type)) {
            const audioPath = `studio-${projectId}/scene-${scene.id}.mp3`
            const { error: uploadErr } = await supabaseAdmin.storage
              .from('voice-samples')
              .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

            if (uploadErr) {
              await markSceneError(
                scene.id,
                new Error(`Audio upload failed: ${uploadErr.message}`),
              )
            } else {
              const { data: signed } = await supabaseAdmin.storage
                .from('voice-samples')
                .createSignedUrl(audioPath, 60 * 60 * 24 * 7) // 7-day URL for HeyGen CDN fetch
              if (signed?.signedUrl) {
                audioUrls.set(scene.id, signed.signedUrl)
                logger.info({ sceneId: scene.id }, 'generate-all: audio pre-gen OK (HeyGen path)')
              } else {
                await markSceneError(
                  scene.id,
                  new Error('Audio pre-generation failed — could not sign URL'),
                )
              }
            }
          } else {
            logger.info({ sceneId: scene.id, type: scene.type }, 'generate-all: audio pre-gen OK (Remotion path)')
          }
        } catch (audioErr) {
          await markSceneError(
            scene.id,
            audioErr instanceof Error
              ? audioErr
              : new Error(`ElevenLabs pre-gen failed: ${String(audioErr)}`),
          )
        }

        // Rate-limit guard: 800ms between ElevenLabs calls
        await new Promise((r) => setTimeout(r, 800))
      }

      // ── Phase 2a — fire all HeyGen jobs in parallel (avatar + split) ──
      const heygenEligible = avatarScenes.filter((s) => audioUrls.has(s.id))
      const heygenVideoIds = new Map<string, string>()

      if (project.avatar_id && heygenEligible.length > 0) {
        const submitResults = await Promise.allSettled(
          heygenEligible.map(async (scene) => {
            const audioUrl = audioUrls.get(scene.id)!
            const { heygenVideoId } = await generateAvatarScene({
              avatarId: project.avatar_id!,
              audioUrl,
              script: scene.script,
              background: { type: 'color', value: project.background_color ?? '#0D1117' },
              callbackId: `${projectId}_scene_${scene.index}`,
              format: project.format === 'both' ? '16_9' : project.format as '16_9' | '9_16',
            })
            await supabaseAdmin
              .from('studio_scenes')
              .update({ heygen_video_id: heygenVideoId })
              .eq('id', scene.id)
            return { sceneId: scene.id, heygenVideoId }
          }),
        )

        for (let i = 0; i < submitResults.length; i++) {
          const r = submitResults[i]
          const scene = heygenEligible[i]
          if (r.status === 'fulfilled') {
            heygenVideoIds.set(scene.id, r.value.heygenVideoId)
          } else {
            await markSceneError(scene.id, r.reason)
          }
        }

        logger.info(
          { projectId, submitted: heygenVideoIds.size },
          'generate-all: HeyGen jobs submitted in parallel',
        )
      }

      // ── Phase 2b — Remotion render (infographic, broll, demo, typography) ──
      const remotionEligible = remotionScenesList.filter((s) => audioBuffers.has(s.id))

      const remotionFormat: '16:9' | '9:16' | '1:1' =
        project.format === '9_16' ? '9:16' : '16:9'

      await Promise.allSettled(
        remotionEligible.map(async (scene) => {
          const voiceoverBuffer = audioBuffers.get(scene.id)!
          const remotionParams  = (scene.remotion_params ?? {}) as Record<string, unknown>
          const sceneLayout     = REMOTION_SCENE_TYPE_MAP[scene.type] ?? 'text_hero'

          logger.info({ sceneId: scene.id, type: scene.type, sceneLayout }, 'generate-all: Remotion render start')

          try {
            const { mp4 } = await renderMotionVideo({
              scenes: [{
                id: scene.id,
                description_visuelle: String(remotionParams.hint ?? scene.script),
                texte_voix:           scene.script,
                duree_estimee:        scene.duration_est ?? 10,
                display_text:         scene.script,
                animation_type:       'fade',
                scene_type:           sceneLayout,
              }],
              brandConfig: {
                primary_color:   project.background_color ?? '#0D1117',
                secondary_color: '#6366f1',
              },
              format:          remotionFormat,
              duration:        String(scene.duration_est ?? 10),
              voiceoverBuffer,
            })

            // Upload rendered MP4 to studio-videos bucket
            const videoPath = `${projectId}/scene-${scene.id}-remotion.mp4`
            const { error: uploadErr } = await supabaseAdmin.storage
              .from('studio-videos')
              .upload(videoPath, mp4, { contentType: 'video/mp4', upsert: true })

            if (uploadErr) throw new Error(`Remotion video upload failed: ${uploadErr.message}`)

            // studio-videos est privé (migration 20260611000001) — on persiste
            // une signed URL longue durée (1 an, même convention que le bucket
            // `videos`) car video_url est lue par le frontend ET re-téléchargée
            // par render-final pour le concat.
            const { data: signed, error: signErr } = await supabaseAdmin.storage
              .from('studio-videos')
              .createSignedUrl(videoPath, 60 * 60 * 24 * 365)
            if (signErr || !signed?.signedUrl) {
              throw new Error(`Failed to sign Remotion video URL: ${signErr?.message ?? 'no signedUrl'}`)
            }

            await supabaseAdmin.from('studio_scenes').update({
              status:    'done',
              video_url: signed.signedUrl,
            }).eq('id', scene.id)

            logger.info({ sceneId: scene.id, type: scene.type }, 'generate-all: Remotion render done')
          } catch (err) {
            await markSceneError(scene.id, err)
          }
        }),
      )

      // ── Phase 3 — poll all HeyGen scenes in parallel ──────────────────
      await Promise.allSettled(
        Array.from(heygenVideoIds.entries()).map(([sceneId, heygenVideoId]) =>
          pollUntilDone(sceneId, heygenVideoId),
        ),
      )

      logger.info(
        { projectId, failed: sceneErrors.size, total: sceneList.length },
        'generate-all: all scene pipelines complete',
      )

      // Partial refund: if every single scene failed, refund the
      // entire deducted amount. We don't pro-rate per-scene refunds
      // here — partial successes still cost (the renderer ran).
      if (sceneErrors.size === sceneList.length && creditCost > 0) {
        await refundCredits(req.userId!, creditCost, `studio_project:${projectId}`, {
          reason: 'all_scenes_failed',
          projectId,
        }).catch((refErr) =>
          logger.warn({ err: refErr, projectId }, 'Studio full refund failed (non-blocking)')
        )
      }
    })().catch(async (err) => {
      logger.error({ err, projectId }, 'generate-all background task failed')
      // Background task crashed before any scene could complete — refund.
      if (creditCost > 0) {
        await refundCredits(req.userId!, creditCost, `studio_project:${projectId}`, {
          reason: 'background_task_crash',
          projectId,
        }).catch((refErr) =>
          logger.warn({ err: refErr, projectId }, 'Studio crash-refund failed (non-blocking)')
        )
      }
    })

    res.status(202).json({ projectId, status: 'generating', credits_deducted: creditCost })
  } catch (err) {
    logger.error({ err }, 'studio.generate-all failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── POST /regenerate-scene ──────────────────────────────────────────────

studioRouter.post('/regenerate-scene', authMiddleware, async (req, res) => {
  try {
    const { projectId, sceneId, feedback, newScript, newType } = req.body as {
      projectId: string; sceneId: string; feedback?: string; newScript?: string; newType?: string
    }
    if (!projectId || !sceneId) { res.status(400).json({ error: 'projectId + sceneId required' }); return }

    const { data: scene } = await supabaseAdmin
      .from('studio_scenes').select('*')
      .eq('id', sceneId).eq('user_id', req.userId).single()
    if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }

    // Archive previous version
    const prevVersions = Array.isArray(scene.previous_versions) ? scene.previous_versions : []
    prevVersions.unshift({
      video_url: scene.video_url,
      created_at: scene.updated_at,
      script: scene.script,
    })

    let scriptToUse = newScript ?? scene.script
    if (feedback && !newScript) {
      // Detect from the existing scene script so the rewrite stays in
      // the same language as the surrounding video.
      const sceneLang = detectLanguage(scene.script)
      const rewritten = await callClaude<SceneRewriterResponse>(
        F5_SCENE_REWRITER_SYSTEM,
        `Current scene (type "${scene.type}"):\n"${scene.script}"\n\nUser feedback:\n${feedback}`,
        'scene_rewriter',
        sceneLang,
      )
      scriptToUse = rewritten.new_script
    }

    await supabaseAdmin.from('studio_scenes').update({
      status: 'regenerating',
      script: scriptToUse,
      type: newType ?? scene.type,
      previous_versions: prevVersions.slice(0, 10),
    }).eq('id', sceneId)

    // Fetch the project to get avatar/voice IDs
    const { data: project } = await supabaseAdmin
      .from('studio_projects').select('avatar_id, voice_id, background_color, format')
      .eq('id', projectId).single()

    const regenVoiceId = project?.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? ELEVENLABS_FALLBACK_VOICE_ID
    const sceneType = newType ?? scene.type
    const isRemotionScene = REMOTION_SCENE_TYPES.has(sceneType)

    if (isRemotionScene) {
      // ── Remotion regen path ──────────────────────────────────────────
      ;(async () => {
        try {
          const audioBuffer = await generateAudioWithFallback(scriptToUse, regenVoiceId, `regen-${sceneId}`)
          const remotionParams  = (scene.remotion_params ?? {}) as Record<string, unknown>
          const sceneLayout     = REMOTION_SCENE_TYPE_MAP[sceneType] ?? 'text_hero'
          const remotionFormat: '16:9' | '9:16' | '1:1' =
            project?.format === '9_16' ? '9:16' : '16:9'

          const { mp4 } = await renderMotionVideo({
            scenes: [{
              id: sceneId,
              description_visuelle: String(remotionParams.hint ?? scriptToUse),
              texte_voix:           scriptToUse,
              duree_estimee:        scene.duration_est ?? 10,
              display_text:         scriptToUse,
              animation_type:       'fade',
              scene_type:           sceneLayout,
            }],
            brandConfig: {
              primary_color:   project?.background_color ?? '#0D1117',
              secondary_color: '#6366f1',
            },
            format:          remotionFormat,
            duration:        String(scene.duration_est ?? 10),
            voiceoverBuffer: audioBuffer,
          })

          const videoPath = `${projectId}/regen-${sceneId}-remotion.mp4`
          const { error: uploadErr } = await supabaseAdmin.storage
            .from('studio-videos')
            .upload(videoPath, mp4, { contentType: 'video/mp4', upsert: true })

          if (uploadErr) throw new Error(`Remotion video upload failed: ${uploadErr.message}`)

          // studio-videos est privé — signed URL 1 an (cf. generate-all).
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from('studio-videos')
            .createSignedUrl(videoPath, 60 * 60 * 24 * 365)
          if (signErr || !signed?.signedUrl) {
            throw new Error(`Failed to sign Remotion video URL: ${signErr?.message ?? 'no signedUrl'}`)
          }

          await supabaseAdmin.from('studio_scenes').update({
            status:    'done',
            video_url: signed.signedUrl,
          }).eq('id', sceneId)

          logger.info({ sceneId, sceneType }, 'regenerate-scene: Remotion render done')
        } catch (err) {
          logger.error({ err, sceneId }, 'regenerate-scene Remotion task failed')
          await supabaseAdmin.from('studio_scenes')
            .update({ status: 'error', error_message: err instanceof Error ? err.message : 'Unknown error' })
            .eq('id', sceneId)
        }
      })().catch((err) => logger.error({ err, sceneId }, 'regenerate-scene Remotion unhandled rejection'))
    } else if (project?.avatar_id) {
      // ── HeyGen regen path ────────────────────────────────────────────
      ;(async () => {
        try {
          let audioUrl: string | undefined
          try {
            const audioBuffer = await generateAudioWithFallback(scriptToUse, regenVoiceId, `regen-${sceneId}`)
            const audioPath = `studio-${projectId}/regen-${sceneId}.mp3`
            const { error: uploadErr } = await supabaseAdmin.storage
              .from('voice-samples')
              .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
            if (uploadErr) {
              logger.warn({ uploadErr: uploadErr.message, audioPath, sceneId }, 'regenerate-scene: audio upload failed')
            } else {
              const { data: signed } = await supabaseAdmin.storage
                .from('voice-samples')
                .createSignedUrl(audioPath, 60 * 60 * 24 * 7)
              audioUrl = signed?.signedUrl ?? undefined
              logger.info({ sceneId, hasAudioUrl: !!audioUrl }, 'regenerate-scene: audio pre-gen OK')
            }
          } catch (audioErr) {
            logger.warn({ audioErr, sceneId }, 'regenerate-scene: ElevenLabs pre-gen failed')
          }

          if (!audioUrl) {
            throw new Error('Audio pre-generation failed — could not obtain a valid audio URL for HeyGen')
          }

          const { heygenVideoId } = await generateAvatarScene({
            avatarId: project.avatar_id,
            audioUrl,
            script:   scriptToUse,
            background: { type: 'color', value: project.background_color ?? '#0D1117' },
            callbackId: `${projectId}_regen_${sceneId}`,
            format: project.format === 'both' ? '16_9' : (project.format as '16_9' | '9_16') ?? '16_9',
          })
          await supabaseAdmin.from('studio_scenes')
            .update({ heygen_video_id: heygenVideoId })
            .eq('id', sceneId)
          await pollUntilDone(sceneId, heygenVideoId)
        } catch (err) {
          logger.error({ err, sceneId }, 'regenerate-scene HeyGen task failed')
          await supabaseAdmin.from('studio_scenes')
            .update({ status: 'error', error_message: err instanceof Error ? err.message : 'Unknown error' })
            .eq('id', sceneId)
        }
      })().catch((err) => logger.error({ err, sceneId }, 'regenerate-scene unhandled rejection'))
    } else {
      logger.info({ sceneId }, 'scene regen queued — no avatar on project, marking error')
      await supabaseAdmin.from('studio_scenes')
        .update({ status: 'error', error_message: 'No avatar configured on project — select an avatar before generating' })
        .eq('id', sceneId)
    }

    res.json({ status: 'regenerating' })
  } catch (err) {
    logger.error({ err }, 'studio.regenerate failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── PATCH /reorder ──────────────────────────────────────────────────────

studioRouter.patch('/reorder', authMiddleware, async (req, res) => {
  try {
    const { projectId, sceneIds } = req.body as { projectId: string; sceneIds: string[] }
    if (!projectId || !Array.isArray(sceneIds)) {
      res.status(400).json({ error: 'projectId + sceneIds required' }); return
    }

    // Verify ownership
    const { data: project } = await supabaseAdmin
      .from('studio_projects').select('id')
      .eq('id', projectId).eq('user_id', req.userId).single()
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }

    // Update indices sequentially (use a temp offset to avoid unique-index violations)
    const TEMP = 10000
    for (let i = 0; i < sceneIds.length; i++) {
      await supabaseAdmin.from('studio_scenes')
        .update({ index: TEMP + i })
        .eq('id', sceneIds[i]!).eq('project_id', projectId)
    }
    for (let i = 0; i < sceneIds.length; i++) {
      await supabaseAdmin.from('studio_scenes')
        .update({ index: i })
        .eq('id', sceneIds[i]!).eq('project_id', projectId)
    }

    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'studio.reorder failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── POST /add-scene ─────────────────────────────────────────────────────

studioRouter.post('/add-scene', authMiddleware, async (req, res) => {
  try {
    const { projectId, afterIndex, type, script, hint } = req.body as {
      projectId: string; afterIndex: number; type?: string; script?: string; hint?: string
    }
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return }

    // Shift all scenes after afterIndex up by 1
    const { data: later } = await supabaseAdmin
      .from('studio_scenes').select('id, index')
      .eq('project_id', projectId).gt('index', afterIndex)

    for (const s of later ?? []) {
      await supabaseAdmin.from('studio_scenes').update({ index: s.index + 1 }).eq('id', s.id)
    }

    const { data: newScene, error } = await supabaseAdmin.from('studio_scenes').insert({
      project_id: projectId,
      user_id: req.userId,
      index: afterIndex + 1,
      type: type ?? 'avatar',
      script: script ?? hint ?? 'New scene — edit the script in the inspector.',
      duration_est: 10,
      status: 'generating',
    }).select().single()

    if (error || !newScene) { res.status(500).json({ error: 'Failed', code: 'DB_ERROR' }); return }
    res.status(201).json({ sceneId: newScene.id })
  } catch (err) {
    logger.error({ err }, 'studio.add-scene failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /scene/:sceneId ──────────────────────────────────────────────

studioRouter.delete('/scene/:sceneId', authMiddleware, async (req, res) => {
  try {
    const { sceneId } = req.params
    const { data: scene } = await supabaseAdmin
      .from('studio_scenes').select('project_id, index')
      .eq('id', sceneId).eq('user_id', req.userId).single()
    if (!scene) { res.status(404).json({ error: 'Not found' }); return }

    await supabaseAdmin.from('studio_scenes').delete().eq('id', sceneId)

    // Compact indices
    const { data: later } = await supabaseAdmin
      .from('studio_scenes').select('id, index')
      .eq('project_id', scene.project_id).gt('index', scene.index)
    for (const s of later ?? []) {
      await supabaseAdmin.from('studio_scenes').update({ index: s.index - 1 }).eq('id', s.id)
    }
    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'studio.delete-scene failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── POST /render-final ──────────────────────────────────────────────────
// F5-011: assembles the individual scene MP4s into a single final video.
// Runs asynchronously — we flip status to 'rendering' then do the work in
// the background. The client polls studio_projects via Supabase Realtime.
studioRouter.post('/render-final', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string; format?: '16_9' | '9_16' }
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return }

    const { data: project } = await supabaseAdmin
      .from('studio_projects').select('*')
      .eq('id', projectId).eq('user_id', req.userId).single()
    if (!project) { res.status(404).json({ error: 'Not found' }); return }

    // Only render when all scenes are done.
    const { data: scenes } = await supabaseAdmin
      .from('studio_scenes')
      .select('id, index, status, video_url')
      .eq('project_id', projectId)
      .order('index', { ascending: true })

    const sceneList = scenes ?? []
    if (sceneList.length === 0) {
      res.status(400).json({ error: 'Project has no scenes to assemble', code: 'EMPTY_PROJECT' })
      return
    }
    const missing = sceneList.filter((s: { status?: string; video_url?: string | null }) => s.status !== 'done' || !s.video_url)
    if (missing.length > 0) {
      res.status(409).json({
        error: `${missing.length} scene(s) not ready — wait for generation or regenerate before exporting`,
        code: 'SCENES_NOT_READY',
      })
      return
    }

    const targetFormat: '16_9' | '9_16' =
      req.body?.format === '9_16' || project.format === '9_16' ? '9_16' : '16_9'

    // Flip project status so the UI can reflect "rendering…".
    await supabaseAdmin
      .from('studio_projects')
      .update({ status: 'rendering' })
      .eq('id', projectId)

    // Kick off the async FFmpeg pipeline and return 202 immediately.
    void runStudioFinalRender(projectId, sceneList, targetFormat).catch((err) => {
      logger.error({ err, projectId }, 'studio.render-final background job crashed')
    })

    res.status(202).json({
      status: 'rendering',
      projectId,
      sceneCount: sceneList.length,
      format: targetFormat,
    })
  } catch (err) {
    logger.error({ err }, 'studio.render-final failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// Background worker for the studio final render.
async function runStudioFinalRender(
  projectId: string,
  scenes: Array<{ id: string; video_url: string }>,
  format: '16_9' | '9_16',
): Promise<void> {
  const startedAt = Date.now()
  // Files written by the optional HyperFrames enrichment step. Cleaned in
  // the finally block regardless of success.
  const hfTempPaths: string[] = []
  try {
    let sceneClips: StudioSceneClip[]

    // ── Decide if this project gets HF enrichment ─────────────────────
    // Per-project flag stored in studio_projects.metadata.use_hyperframes
    // wins over the worker-wide ENRICH_AVATAR_WITH_HYPERFRAMES env var,
    // so users can opt-in/out without touching infra. The env var stays
    // as a master kill-switch (set 'false' to disable HF for ALL projects).
    const [{ data: projectForFlag }, { data: fullScenesForFlag }] = await Promise.all([
      supabaseAdmin
        .from('studio_projects')
        .select('title, background_color, format, metadata')
        .eq('id', projectId)
        .single()
        .then((r) => r, () => ({ data: null })),
      supabaseAdmin
        .from('studio_scenes')
        .select('id, duration_est, script_text')
        .eq('project_id', projectId)
        .then((r) => r, () => ({ data: null })),
    ])

    const projectMeta = (projectForFlag?.metadata ?? {}) as Record<string, unknown>
    const projectFlag = typeof projectMeta.use_hyperframes === 'boolean'
      ? projectMeta.use_hyperframes as boolean
      : null
    // If the env var is explicitly 'false', force-disable regardless of project flag.
    // Otherwise: project flag wins; if absent, fall back to env-based default.
    const envKillSwitch = process.env.ENRICH_AVATAR_WITH_HYPERFRAMES === 'false'
    const useHyperframes = !envKillSwitch && (projectFlag ?? isHyperframesEnabled())

    if (useHyperframes) {
      // ── HyperFrames enrichment path ─────────────────────────────────
      // For each HeyGen avatar clip, compose a richer scene with brand
      // lower-third + animated caption + cinematic vignette. Each HF
      // compose runs in its own tmp project dir; we batch with concurrency
      // 2 (each spawns 1 Chrome via --workers=1 + ffmpeg encode ≈ ~550 MB
      // peak, fits inside Render Standard's 2 GB minus heap cap).
      logger.info(
        { projectId, sceneCount: scenes.length, source: projectFlag === null ? 'env' : 'project' },
        'Studio: HyperFrames enrichment starting'
      )

      const { join } = await import('path')
      const { tmpdir } = await import('os')
      const { randomUUID } = await import('crypto')

      // Reuse the data we already fetched above for the flag check.
      const project = projectForFlag
      const fullScenes = fullScenesForFlag

      // Brand color priority : project metadata.brand_color > project
      // background_color (HeyGen scene bg) > CLYRO blue default.
      const projectBrandColor = typeof projectMeta.brand_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(projectMeta.brand_color)
        ? projectMeta.brand_color as string
        : null
      const brandColor = projectBrandColor
        ?? ((typeof project?.background_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(project.background_color))
          ? project.background_color
          : '#3B8EF0')
      const projectTitle = (typeof project?.title === 'string' && project.title.trim()) ? project.title : 'CLYRO'

      // Template choice : per-project metadata > default 'avatar-lower-third'.
      type HFTemplate = 'avatar-lower-third' | 'avatar-intro-card' | 'avatar-pip' | 'avatar-tiktok' | 'avatar-instagram' | 'avatar-logo-outro'
      const VALID_TEMPLATES: readonly HFTemplate[] = [
        'avatar-lower-third', 'avatar-intro-card', 'avatar-pip', 'avatar-tiktok', 'avatar-instagram', 'avatar-logo-outro',
      ]
      const candidate = typeof projectMeta.hyperframes_template === 'string'
        ? projectMeta.hyperframes_template
        : ''
      const projectTemplate: HFTemplate = (VALID_TEMPLATES as readonly string[]).includes(candidate)
        ? candidate as HFTemplate
        : 'avatar-lower-third'
      type SceneMeta = { id: string; duration_est: number | null; script_text: string | null }
      const sceneMetaById = new Map<string, SceneMeta>(
        ((fullScenes ?? []) as SceneMeta[]).map((s) => [s.id, s]),
      )

      // Concurrency 2 — each HF compose spawns a Chrome + ffmpeg.
      const HF_CONCURRENCY = Number(process.env.HYPERFRAMES_CONCURRENCY ?? 2)
      const enriched: StudioSceneClip[] = []

      for (let i = 0; i < scenes.length; i += HF_CONCURRENCY) {
        const batch = scenes.slice(i, i + HF_CONCURRENCY)
        const batchResults = await Promise.all(
          batch.map(async (s, batchIdx) => {
            const sceneIdx = i + batchIdx
            const meta = sceneMetaById.get(s.id)
            const tempPath = join(tmpdir(), `clyro-hf-${randomUUID()}.mp4`)
            try {
              await composeAvatarSceneWithHyperframes({
                avatarVideoUrl:    s.video_url,
                durationSeconds:   typeof meta?.duration_est === 'number' && meta.duration_est > 0 ? meta.duration_est : 8,
                format,
                brandColor,
                lowerThirdTitle:   projectTitle,
                lowerThirdSub:     `Scene ${sceneIdx + 1}`,
                captionText:       (meta?.script_text ?? '').slice(0, 80),
                outputPath:        tempPath,
                template:          projectTemplate,
                workers:           1,
              })
              hfTempPaths.push(tempPath)
              return { sceneId: s.id, videoUrl: `file://${tempPath}` }
            } catch (err) {
              logger.warn(
                { err: (err as Error).message, sceneId: s.id, projectId },
                'Studio HF: compose failed for scene — falling back to raw HeyGen MP4',
              )
              return { sceneId: s.id, videoUrl: s.video_url }
            }
          }),
        )
        enriched.push(...batchResults)
      }

      sceneClips = enriched
      logger.info(
        {
          projectId,
          sceneCount: scenes.length,
          enrichedCount: hfTempPaths.length,
          fallbackCount: scenes.length - hfTempPaths.length,
          durationMs: Date.now() - startedAt,
        },
        'Studio: HyperFrames enrichment complete',
      )
    } else {
      // ── Default path : raw HeyGen MP4s, just concat ─────────────────
      sceneClips = scenes.map((s) => ({
        sceneId: s.id,
        videoUrl: s.video_url,
      }))
    }

    const buf = await assembleStudioVideo(sceneClips, format)

    // Upload to Supabase Storage (bucket: studio-videos).
    const storagePath = `${projectId}/final-${format}-${Date.now()}.mp4`
    const UPLOAD_MAX_RETRIES = 3
    let uploadErr: { message: string } | null = null
    for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
      const result = await supabaseAdmin.storage
        .from('studio-videos')
        .upload(storagePath, buf, {
          contentType: 'video/mp4',
          upsert: true,
        })
      uploadErr = result.error
      if (!uploadErr) break
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, [5_000, 15_000, 30_000][attempt - 1] ?? 30_000))
      }
    }
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

    // studio-videos est privé (migration 20260611000001) — signed URL 1 an,
    // même convention que les output_url du bucket `videos` (l'URL est
    // persistée en DB et lue par le frontend pour la lecture/téléchargement).
    const { data: signedFinal, error: signFinalErr } = await supabaseAdmin.storage
      .from('studio-videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
    if (signFinalErr || !signedFinal?.signedUrl) {
      throw new Error(`Failed to sign final video URL: ${signFinalErr?.message ?? 'no signedUrl'}`)
    }
    const finalUrl = signedFinal.signedUrl

    const urlColumn = format === '9_16' ? 'final_video_9_16_url' : 'final_video_url'
    await supabaseAdmin
      .from('studio_projects')
      .update({ status: 'done', [urlColumn]: finalUrl })
      .eq('id', projectId)

    logger.info(
      { projectId, durationMs: Date.now() - startedAt, finalUrl },
      'studio.render-final: done',
    )
  } catch (err) {
    logger.error({ err, projectId }, 'studio.render-final: background job failed')
    await supabaseAdmin
      .from('studio_projects')
      .update({ status: 'error' })
      .eq('id', projectId)
      .then(() => null, () => null)
  } finally {
    // Cleanup HyperFrames intermediate MP4s. Best-effort — leftover files
    // in /tmp eventually get reaped by the OS but this keeps disk usage
    // bounded across long-running worker sessions.
    if (hfTempPaths.length > 0) {
      const { unlink } = await import('fs/promises')
      await Promise.all(hfTempPaths.map((p) => unlink(p).catch(() => null)))
    }
  }
}

// ── GET /avatars ────────────────────────────────────────────────────────

// HeyGen's /v2/avatars returns 300-600 avatars with ~1-3s latency. The list
// is effectively static per-user (HeyGen adds avatars weekly at most), so a
// 15-minute cache slashes p50 latency to near-zero for repeat visitors.
// Cache is process-local — resets on redeploy, which is the desired "cache bust".
const CACHE_TTL_AVATARS_MS = 15 * 60 * 1000
const getCachedAvatars = memoizeTTL('heygen.avatars', CACHE_TTL_AVATARS_MS, listAvatars)

studioRouter.get('/avatars', authMiddleware, async (_req, res) => {
  try {
    const avatars = await getCachedAvatars()
    // Group by category for the frontend tabs
    const categories = [...new Set(avatars.map((a) => a.category))]
    res.json({ avatars, categories })
  } catch (err) {
    logger.error({ err }, 'studio.avatars failed')
    res.status(500).json({ error: 'Failed to list avatars', code: 'HEYGEN_ERROR' })
  }
})

// ── GET /projects/:id (fetch a project + its scenes) ────────────────────

studioRouter.get('/projects/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const [{ data: project }, { data: scenes }] = await Promise.all([
    supabaseAdmin.from('studio_projects').select('*').eq('id', id).eq('user_id', req.userId).single(),
    supabaseAdmin.from('studio_scenes').select('*').eq('project_id', id).order('index', { ascending: true }),
  ])
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ project, scenes: scenes ?? [] })
})
