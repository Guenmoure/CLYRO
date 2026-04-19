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

export const studioRouter = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

async function callClaude<T>(system: string, user: string, label: string): Promise<T> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,  // 4096 was too low — long scripts with 8+ scenes hit the limit
    system,
    messages: [{ role: 'user', content: user }],
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

      // Stage 2: Claude improves the raw transcript
      const improved = await callClaude<YoutubeImproverResponse>(
        F5_YOUTUBE_IMPROVER_SYSTEM,
        `Transcription brute :\n\n${originalScript}`,
        'youtube_improver',
      )
      improvedScript = improved.improved_script
    }

    // 2. Claude Script Director splits into typed scenes
    const scriptToDirect = improvedScript ?? originalScript
    const directed = await callClaude<ScriptDirectorResponse>(
      F5_SCRIPT_DIRECTOR_SYSTEM,
      `Script :\n\n${scriptToDirect}`,
      'script_director',
    )

    // 3. Create project + scenes in Supabase
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
      status:      'pending' as const,
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

    await supabaseAdmin.from('studio_projects').update({ status: 'generating' }).eq('id', projectId)

    // Fire-and-forget scene generation. Each type has its own pipeline.
    // NOTE(F5): Remotion + Pexels paths are stubbed for now — marked as
    // 'error' so the timeline UI shows them visibly and the user can retry.
    // Resolve the effective voice ID: prefer the one stored on the project,
    // fall back to the server default (ELEVENLABS_DEFAULT_VOICE_ID).
    // The Studio wizard has no voice picker yet — voice_id is often null.
    const effectiveVoiceId = project.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? ''

    ;(async () => {
      for (const scene of scenes ?? []) {
        await supabaseAdmin.from('studio_scenes').update({ status: 'generating' }).eq('id', scene.id)

        try {
          if (project.avatar_id) {
            // Non-avatar types (infographic, demo, typography, broll) are not yet
            // fully implemented as separate Remotion/Pexels pipelines. We fall back
            // to a standard avatar render so every scene produces a real video.
            const isNativeAvatarType = scene.type === 'avatar' || scene.type === 'split'
            if (!isNativeAvatarType) {
              logger.info(
                { sceneId: scene.id, type: scene.type },
                `generate-all: type "${scene.type}" not implemented — falling back to avatar render`,
              )
            }

            // Pre-generate audio with ElevenLabs so HeyGen receives a real audio URL.
            // This avoids the HeyGen TTS voice_id mismatch (ElevenLabs IDs ≠ HeyGen IDs).
            // We also add an 800ms inter-scene delay to stay under ElevenLabs rate limits
            // (34 scenes back-to-back would otherwise trigger a 429).
            let audioUrl: string | undefined
            if (effectiveVoiceId) {
              try {
                const { audioBuffer } = await generateVoiceoverWithTimestamps(scene.script, effectiveVoiceId)
                const audioPath = `studio/${projectId}/audio/scene-${scene.id}.mp3`
                // Use application/octet-stream — studio-videos bucket only allows video/* mime types
                // but the service role key bypasses mime restrictions (same pattern as faceless voiceover).
                const { error: uploadErr } = await supabaseAdmin.storage
                  .from('studio-videos')
                  .upload(audioPath, audioBuffer, { contentType: 'application/octet-stream', upsert: true })
                if (!uploadErr) {
                  const { data: signed } = await supabaseAdmin.storage
                    .from('studio-videos')
                    .createSignedUrl(audioPath, 60 * 60 * 24 * 7) // 7-day URL — enough for HeyGen CDN fetch
                  audioUrl = signed?.signedUrl ?? undefined
                }
                // Rate-limit guard: 800ms between ElevenLabs calls
                await new Promise((r) => setTimeout(r, 800))
              } catch (audioErr) {
                logger.warn({ audioErr, sceneId: scene.id }, 'generate-all: ElevenLabs pre-gen failed — proceeding without audio')
              }
            }

            const { heygenVideoId } = await generateAvatarScene({
              avatarId: project.avatar_id,
              voiceId:  audioUrl ? undefined : (effectiveVoiceId || undefined),
              audioUrl,
              script:   scene.script,
              background: { type: 'color', value: project.background_color ?? '#0D1117' },
              callbackId: `${projectId}_scene_${scene.index}`,
              format: project.format === 'both' ? '16_9' : project.format as '16_9' | '9_16',
            })
            await supabaseAdmin.from('studio_scenes')
              .update({ heygen_video_id: heygenVideoId })
              .eq('id', scene.id)
            // Poll HeyGen status until completed/failed (webhook fallback).
            await pollUntilDone(scene.id, heygenVideoId)
          } else {
            await supabaseAdmin.from('studio_scenes')
              .update({
                status: 'error',
                error_message: 'No avatar configured on project — select an avatar before generating',
              })
              .eq('id', scene.id)
          }
        } catch (err) {
          logger.error({ err, sceneId: scene.id }, 'scene generation failed')
          await supabaseAdmin.from('studio_scenes')
            .update({ status: 'error', error_message: err instanceof Error ? err.message : 'Unknown error' })
            .eq('id', scene.id)
        }
      }
    })().catch((err) => logger.error({ err, projectId }, 'generate-all background task failed'))

    res.status(202).json({ projectId, status: 'generating' })
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
      const rewritten = await callClaude<SceneRewriterResponse>(
        F5_SCENE_REWRITER_SYSTEM,
        `Scène actuelle (type "${scene.type}") :\n"${scene.script}"\n\nFeedback utilisateur :\n${feedback}`,
        'scene_rewriter',
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

    if (project?.avatar_id) {
      const regenVoiceId = project.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? ''
      ;(async () => {
        try {
          // Pre-generate ElevenLabs audio (same fix as generate-all)
          let audioUrl: string | undefined
          if (regenVoiceId) {
            try {
              const { audioBuffer } = await generateVoiceoverWithTimestamps(scriptToUse, regenVoiceId)
              const audioPath = `studio/${projectId}/audio/regen-${sceneId}.mp3`
              const { error: uploadErr } = await supabaseAdmin.storage
                .from('studio-videos')
                .upload(audioPath, audioBuffer, { contentType: 'application/octet-stream', upsert: true })
              if (!uploadErr) {
                const { data: signed } = await supabaseAdmin.storage
                  .from('studio-videos')
                  .createSignedUrl(audioPath, 60 * 60 * 24 * 7)
                audioUrl = signed?.signedUrl ?? undefined
              }
            } catch (audioErr) {
              logger.warn({ audioErr, sceneId }, 'regenerate-scene: ElevenLabs pre-gen failed — HeyGen TTS fallback')
            }
          }

          const { heygenVideoId } = await generateAvatarScene({
            avatarId: project.avatar_id,
            voiceId:  audioUrl ? undefined : (regenVoiceId || undefined),
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
          logger.error({ err, sceneId }, 'regenerate-scene background task failed')
          await supabaseAdmin.from('studio_scenes')
            .update({ status: 'error', error_message: err instanceof Error ? err.message : 'Unknown error' })
            .eq('id', sceneId)
        }
      })().catch((err) => logger.error({ err, sceneId }, 'regenerate-scene unhandled rejection'))
    } else {
      logger.info({ sceneId }, 'scene regen queued — no avatar/voice on project, marking error')
      await supabaseAdmin.from('studio_scenes')
        .update({ status: 'error', error_message: 'No avatar or voice configured on project' })
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
      status: 'pending',
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
  try {
    const sceneClips: StudioSceneClip[] = scenes.map((s) => ({
      sceneId: s.id,
      videoUrl: s.video_url,
    }))

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

    const { data: pub } = supabaseAdmin.storage
      .from('studio-videos')
      .getPublicUrl(storagePath)
    const publicUrl = pub.publicUrl

    const urlColumn = format === '9_16' ? 'final_video_9_16_url' : 'final_video_url'
    await supabaseAdmin
      .from('studio_projects')
      .update({ status: 'done', [urlColumn]: publicUrl })
      .eq('id', projectId)

    logger.info(
      { projectId, durationMs: Date.now() - startedAt, publicUrl },
      'studio.render-final: done',
    )
  } catch (err) {
    logger.error({ err, projectId }, 'studio.render-final: background job failed')
    await supabaseAdmin
      .from('studio_projects')
      .update({ status: 'error' })
      .eq('id', projectId)
      .then(() => null, () => null)
  }
}

// ── GET /avatars ────────────────────────────────────────────────────────

studioRouter.get('/avatars', authMiddleware, async (_req, res) => {
  try {
    const avatars = await listAvatars()
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
