import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * POST /api/videos/:id/duplicate
 *
 * "Edit as New" — clones a video row as a fresh draft owned by the same user.
 *
 *   • The new row has status='draft' and a fresh id.
 *   • metadata is copied verbatim so all per-scene assets (image URLs, clip
 *     URLs, voice ids, prompts, etc.) are preserved. That lets the user
 *     regenerate a single element on the copy without re-paying for the rest.
 *   • wizard_state is copied when present. For completed videos (which
 *     typically have no wizard_state left) we rehydrate it from metadata the
 *     same way /api/videos/:id/revert-draft does.
 *   • wizard_step lands the user on the *last* wizard step, so the copy opens
 *     directly on the review / scene-editor view with every field filled in.
 *   • The original is never mutated.
 */

// Last wizard step (1-indexed) per module. The /new pages subtract 1 on load
// to convert to their 0-indexed currentStep state.
const LAST_STEP_BY_MODULE: Record<string, number> = {
  faceless: 6,
  motion:   5,
  brand:    6,
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch source + enforce ownership in a single query
  const { data: source, error: fetchErr } = await supabase
    .from('videos')
    .select(
      'title, module, style, output_url, thumbnail_url, metadata, wizard_state, wizard_step',
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !source) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const module = (source.module ?? 'faceless') as string
  const lastStep = LAST_STEP_BY_MODULE[module] ?? 6

  // ── Rehydrate wizard_state when it's missing (typical for finished videos) ─
  const existingState = (source.wizard_state ?? null) as Record<string, unknown> | null
  const hasUsableState = existingState && Object.keys(existingState).length > 0

  let wizardState: Record<string, unknown>
  if (hasUsableState) {
    wizardState = existingState
  } else {
    const meta = (source.metadata ?? {}) as Record<string, unknown>

    if (module === 'faceless') {
      const scenes = (meta.scenes as Array<{ texte_voix?: string }>) ?? []
      const scriptFromScenes = scenes
        .map((s) => s.texte_voix ?? '')
        .filter(Boolean)
        .join('\n\n')
      const script = (meta.script_draft as string | undefined) ?? scriptFromScenes

      wizardState = {
        script,
        style:         source.style ?? 'cinematique',
        selectedVoice: meta.voice_id,
        format:        meta.format  ?? '9:16',
        duration:      meta.duration ?? '60s',
        animationMode: meta.animation_mode ?? 'storyboard',
        dialogueMode:  meta.dialogue_mode ?? false,
      }
    } else if (module === 'motion') {
      const brand = (meta.brand_config ?? {}) as Record<string, string>
      wizardState = {
        brief:          meta.brief ?? '',
        style:          source.style ?? 'corporate',
        format:         meta.format ?? '9:16',
        duration:       meta.duration ?? '60s',
        primaryColor:   brand.primary_color   ?? '#3B8EF0',
        secondaryColor: brand.secondary_color ?? '#9B5CF6',
        fontFamily:     brand.font_family     ?? 'Inter',
        voiceId:        meta.voice_id,
      }
    } else if (module === 'brand') {
      const brand = (meta.brand_config ?? {}) as Record<string, unknown>
      wizardState = {
        brandName:      (meta.brand_name ?? brand.brand_name) ?? '',
        industry:       meta.industry ?? '',
        values:         meta.values ?? '',
        primaryColor:   brand.primary_color ?? '#0891b2',
        secondaryColor: brand.secondary_color ?? '#0d9488',
        fontFamily:     brand.font_family ?? 'Inter',
        logoMode:       meta.logo_mode ?? 'upload',
        logoUrl:        meta.logo_url,
        logoPrompt:     meta.logo_prompt ?? '',
        selectedAssets: meta.selected_assets ?? ['logo', 'social_post'],
      }
    } else {
      wizardState = {}
    }
  }

  // Land the copy on the last wizard step when the source was a finished
  // video. For an in-progress draft, respect whatever step the user had
  // reached — unless it's beyond the known last step, in which case clamp.
  const sourceStep = typeof source.wizard_step === 'number' ? source.wizard_step : null
  const wizardStep = hasUsableState && sourceStep
    ? Math.min(sourceStep, lastStep)
    : lastStep

  // ── Title: suffix with " (copy)" unless it already ends with one ──────────
  const baseTitle = (source.title ?? 'Untitled').trim()
  const copyTitle = /\(copy( \d+)?\)\s*$/i.test(baseTitle)
    ? baseTitle
    : `${baseTitle} (copy)`

  // ── Insert the clone ──────────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from('videos')
    .insert({
      user_id:       user.id,
      title:         copyTitle,
      module:        source.module,
      style:         source.style,
      status:        'draft',
      // Keep asset URLs so the grid thumbnail and any per-scene previews still
      // render. They'll be overwritten once the user re-renders.
      output_url:    source.output_url,
      thumbnail_url: source.thumbnail_url,
      metadata:      source.metadata,
      wizard_state:  wizardState,
      wizard_step:   wizardStep,
    })
    .select('id, module')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: 'Failed to duplicate video' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    id:     inserted.id,
    module: inserted.module ?? module,
  })
}
