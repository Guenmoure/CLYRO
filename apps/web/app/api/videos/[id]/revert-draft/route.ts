import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * POST /api/videos/:id/revert-draft
 *
 * Converts an error video back to a draft so the user can resume it
 * without burning tokens to recreate the entire project from scratch.
 *
 * Reconstructs wizard_state from the video's stored metadata so the
 * appropriate wizard can be pre-filled.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch & verify ownership in a single query
  const { data: video, error: fetchErr } = await supabase
    .from('videos')
    .select('id, module, style, status, metadata, title')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.status !== 'error') {
    return NextResponse.json(
      { error: 'Only failed videos can be reverted to draft' },
      { status: 400 },
    )
  }

  // ── Reconstruct wizard_state from stored metadata ──────────────────────────
  const meta = (video.metadata ?? {}) as Record<string, unknown>
  let wizardState: Record<string, unknown> = {}

  if (video.module === 'faceless') {
    // Rebuild the original script from per-scene voiceover text
    // 1. Prefer the raw script stored at creation time (script_draft)
    // 2. Fallback: concatenate per-scene voiceover text (available if scenes were generated)
    const scenes = (meta.scenes as Array<{ texte_voix?: string }>) ?? []
    const scriptFromScenes = scenes.map((s) => s.texte_voix ?? '').filter(Boolean).join('\n\n')
    const script = (meta.script_draft as string | undefined) ?? scriptFromScenes

    wizardState = {
      script,
      style:          video.style ?? 'cinematique',
      selectedVoice:  meta.voice_id,
      format:         meta.format  ?? '9:16',
      duration:       meta.duration ?? '60s',
      animationMode:  meta.animation_mode ?? 'storyboard',
    }
  } else if (video.module === 'motion') {
    const brand = (meta.brand_config ?? {}) as Record<string, string>
    wizardState = {
      brief:          meta.brief ?? '',
      style:          video.style ?? 'corporate',
      format:         meta.format ?? '9:16',
      duration:       meta.duration ?? '60s',
      primaryColor:   brand.primary_color   ?? '#3B8EF0',
      secondaryColor: brand.secondary_color ?? '#9B5CF6',
      fontFamily:     brand.font_family     ?? 'Inter',
      voiceId:        meta.voice_id,
    }
  } else if (video.module === 'studio') {
    // Studio: store input mode so the wizard restores to script tab
    wizardState = { mode: 'script', language: 'fr' }
  }

  // ── Persist the draft revert ───────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('videos')
    .update({
      status:       'draft',
      wizard_state: wizardState,
      wizard_step:  1,
      output_url:   null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to revert video' }, { status: 500 })
  }

  return NextResponse.json({
    id:     video.id,
    module: video.module,
  })
}
