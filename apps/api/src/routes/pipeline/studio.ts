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
  listAvatars,
} from '../../services/heygen'
import { transcribeYouTube, isValidYouTubeUrl } from '../../services/transcribe'

export const studioRouter = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Helpers ─────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in Claude response')
  return match[0]
}

async function callClaude<T>(system: string, user: string, label: string): Promise<T> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
  try {
    return JSON.parse(extractJson(raw)) as T
  } catch (err) {
    logger.error({ err, raw: raw.slice(0, 400), label }, 'Claude JSON parse failed')
    throw new Error(`Claude ${label} returned invalid JSON`)
  }
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
    ;(async () => {
      for (const scene of scenes ?? []) {
        await supabaseAdmin.from('studio_scenes').update({ status: 'generating' }).eq('id', scene.id)

        try {
          if ((scene.type === 'avatar' || scene.type === 'split') && project.avatar_id && project.voice_id) {
            const { heygenVideoId } = await generateAvatarScene({
              avatarId: project.avatar_id,
              voiceId:  project.voice_id,
              script:   scene.script,
              background: { type: 'color', value: project.background_color ?? '#0D1117' },
              callbackId: `${projectId}_scene_${scene.index}`,
              format: project.format === 'both' ? '16_9' : project.format as '16_9' | '9_16',
            })
            await supabaseAdmin.from('studio_scenes')
              .update({ heygen_video_id: heygenVideoId })
              .eq('id', scene.id)
            // Webhook will flip the scene to 'done' when HeyGen finishes.
          } else {
            // TODO(F5): infographic → Remotion Lambda render
            // TODO(F5): demo → Remotion Lambda render
            // TODO(F5): typography → Remotion Lambda render
            // TODO(F5): broll → Pexels search + ElevenLabs VO + FFmpeg mux
            await supabaseAdmin.from('studio_scenes')
              .update({
                status: 'error',
                error_message: `Scene type "${scene.type}" pipeline not yet implemented`,
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

    // TODO(F5): actually trigger the regeneration per type, same switch as
    // /generate-all — extract into a `regenerateScene(sceneId)` helper.
    logger.info({ sceneId }, 'scene regen queued (pipeline stubbed)')

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
// TODO(F5): FFmpeg concat of all scenes + music + transitions + upload
studioRouter.post('/render-final', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string; format?: string }
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return }

    const { data: project } = await supabaseAdmin
      .from('studio_projects').select('*')
      .eq('id', projectId).eq('user_id', req.userId).single()
    if (!project) { res.status(404).json({ error: 'Not found' }); return }

    logger.info({ projectId }, 'render-final called — FFmpeg pipeline not yet implemented')
    res.status(501).json({
      error: 'Final render pipeline not yet implemented',
      code: 'NOT_IMPLEMENTED',
      hint: 'Scene-level MP4s are available individually via the timeline.',
    })
  } catch (err) {
    logger.error({ err }, 'studio.render-final failed')
    res.status(500).json({ error: 'Failed', code: 'INTERNAL_ERROR' })
  }
})

// ── GET /avatars ────────────────────────────────────────────────────────

studioRouter.get('/avatars', authMiddleware, async (_req, res) => {
  try {
    const avatars = await listAvatars()
    // HeyGen doesn't distinguish stock from personal in the default listing —
    // front-end can filter by premium flag or name tag if needed.
    res.json({ stock: avatars, personal: [] })
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
