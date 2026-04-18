import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * POST /api/videos/:id/duplicate
 *
 * "Edit as New" — clones a video row as a fresh draft owned by the same user.
 *
 *   • New id, status='draft', " (copy)" suffix on title.
 *   • metadata is copied verbatim so every per-scene asset (image urls, clip
 *     urls, voice id, prompts) is preserved. That lets the user regenerate a
 *     single element on the copy without re-paying for the rest.
 *   • wizard_state is either cloned (when the source already has a usable
 *     one — typical for drafts) or rehydrated from metadata (typical for
 *     finished videos). Faceless gets the hub-shape state so the new draft
 *     opens directly in the scene editor with all scenes intact. Motion /
 *     brand get the /new wizard shape so they land on the review step.
 *   • The original is never mutated.
 *
 *   Response: { id, module, target } where `target` is 'hub' | 'new' — tells
 *   the caller which route the copy belongs on.
 */

// Last wizard step (1-indexed) per module — used only for the /new wizard
// target. The wizard pages subtract 1 on load to get their 0-indexed step.
const LAST_STEP_BY_MODULE: Record<string, number> = {
  faceless: 6,
  motion:   5,
  brand:    6,
}

type Target = 'hub' | 'new'

// Faceless: route the copy into the hub's scene editor. Motion/Brand don't
// have a scene editor yet, so they land on the review step of /new.
function targetForModule(module: string): Target {
  return module === 'faceless' ? 'hub' : 'new'
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

  const { data: source, error: fetchErr } = await supabase
    .from('videos')
    .select(
      'title, module, style, output_url, thumbnail_url, metadata, wizard_state, wizard_step',
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr) {
    // Distinguish "row missing / RLS denied" (PGRST116 = no rows) from a
    // genuine query error (e.g. unknown column when prod schema is behind).
    // Surfacing the real message makes schema-drift bugs immediately obvious
    // instead of looking like the source row vanished.
    console.error('[duplicate] select failed', fetchErr)
    if (fetchErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Database error', detail: fetchErr.message, code: fetchErr.code },
      { status: 500 },
    )
  }
  if (!source) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const module   = (source.module ?? 'faceless') as string
  const target   = targetForModule(module)
  const lastStep = LAST_STEP_BY_MODULE[module] ?? 6

  const meta = (source.metadata ?? {}) as Record<string, unknown>
  const existingState = (source.wizard_state ?? null) as Record<string, unknown> | null
  const hasUsableState = !!existingState && Object.keys(existingState).length > 0
  const isHubState = hasUsableState && existingState.hub === true

  // ── Build the wizard_state for the duplicate ─────────────────────────────
  let wizardState: Record<string, unknown>
  let wizardStep: number

  if (target === 'hub') {
    // Hub-shape state. Faceless Hub's FacelessPipeline hydrates from this.
    if (isHubState) {
      // Source already uses hub-shape — clone verbatim, but reset transient
      // statuses so the Regenerate buttons aren't stuck in 'generating'.
      const src = existingState as Record<string, unknown>
      const srcScenes = Array.isArray(src.scenes) ? (src.scenes as Array<Record<string, unknown>>) : []
      wizardState = {
        ...src,
        scenes: srcScenes.map((s) => ({
          ...s,
          imageStatus: s.imageUrl ? 'done' : 'idle',
          clipStatus:  s.clipUrl  ? 'done' : 'idle',
        })),
      }
    } else {
      // Rehydrate hub-shape state from backend metadata (finished video).
      const metaScenes = (meta.scenes as Array<Record<string, unknown>> | undefined) ?? []
      const scenes = metaScenes.map((s, i) => ({
        id:              (s.scene_id as string | undefined) ?? `scene-${i}-${Date.now()}`,
        index:           (s.index as number | undefined) ?? i,
        scriptText:      (s.texte_voix         as string | undefined) ?? '',
        imagePrompt:     (s.description_visuelle as string | undefined) ?? '',
        animationPrompt: (s.animation_prompt   as string | undefined) ?? '',
        imageUrl:        (s.image_url          as string | undefined) ?? undefined,
        imageStatus:     s.image_url ? 'done' : 'idle',
        clipUrl:         (s.clip_url           as string | undefined) ?? undefined,
        clipStatus:      s.clip_url  ? 'done' : 'idle',
        duree_estimee:   (s.duree_estimee      as number | undefined) ?? undefined,
      }))
      wizardState = {
        hub:         true,
        title:       source.title ?? '',
        style:       source.style ?? 'cinematique',
        voiceId:     (meta.voice_id as string | undefined) ?? '',
        format:      (meta.format    as string | undefined) ?? '9:16',
        duration:    (meta.duration  as string | undefined) ?? '60s',
        description: (meta.description as string | undefined) ?? '',
        script:      (meta.script_draft as string | undefined)
                     ?? scenes.map((s) => s.scriptText).filter(Boolean).join('\n\n'),
        inputType:   'script',
        scenes,
        // Land on the scenes/images editor by default — that's where the user
        // picks an element to regenerate. If the source has clips already,
        // open the clips editor instead so they see the animation previews.
        step:        scenes.some((s) => s.clipUrl) ? 'clips' : 'images',
        animationMode: (meta.animation_mode as string | undefined) ?? 'fast',
      }
    }
    // Hub ignores wizard_step; we still set a sensible value for /new users.
    wizardStep = lastStep
  } else {
    // /new wizard target (motion, brand, or any future module). Reuse the
    // Phase-1 logic: copy wizard_state if present, else rehydrate from meta.
    if (hasUsableState) {
      wizardState = existingState
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
    const sourceStep = typeof source.wizard_step === 'number' ? source.wizard_step : null
    wizardStep = hasUsableState && sourceStep
      ? Math.min(sourceStep, lastStep)
      : lastStep
  }

  // ── Title: suffix with " (copy)" unless it already ends with one ─────────
  const baseTitle = (source.title ?? 'Untitled').trim()
  const copyTitle = /\(copy( \d+)?\)\s*$/i.test(baseTitle)
    ? baseTitle
    : `${baseTitle} (copy)`

  // ── Insert the clone ─────────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from('videos')
    .insert({
      user_id:       user.id,
      title:         copyTitle,
      module:        source.module,
      style:         source.style,
      status:        'draft',
      output_url:    source.output_url,
      thumbnail_url: source.thumbnail_url,
      metadata:      source.metadata,
      wizard_state:  wizardState,
      wizard_step:   wizardStep,
    })
    .select('id, module')
    .single()

  if (insertErr || !inserted) {
    console.error('[duplicate] insert failed', insertErr)
    return NextResponse.json(
      {
        error: 'Failed to duplicate video',
        detail: insertErr?.message,
        code:   insertErr?.code,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    id:     inserted.id,
    module: inserted.module ?? module,
    target,
  })
}
