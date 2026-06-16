import { NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

const bodySchema = z.object({
  prompt: z.string().min(1),
  style: z.string().min(1),
  seed: z.number().int().optional(),
  styleReferenceUrl: z.string().url().optional(),
})

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STYLE_PREFIXES: Record<string, string> = {
  'cinematique':      'cinematic lighting, dramatic composition, film grain,',
  'stock-vo':         'realistic photograph, natural light, documentary style,',
  'whiteboard':       'hand-drawn whiteboard sketch, black marker on white,',
  'stickman':         'hand-drawn black ink stick figure illustration, simple line drawing on white paper, minimalist cartoon style,',
  'flat-design':      'flat vector illustration, bold solid colors,',
  'infographie':      'flat infographic illustration, bold colors, icons,',
  '3d-pixar':         'Pixar 3D CGI render, warm lighting, expressive character,',
  'motion-graphics':  'motion graphics design, geometric shapes, vibrant colors,',
  'animation-2d':     'flat cartoon 2D illustration, vibrant colors, bold outlines,',
  'minimaliste':      'minimalist line art, white background, clean shapes,',
  'corporate':        'clean corporate illustration, professional, navy blue,',
  'dynamique':        'high-energy dynamic composition, neon accents, dark background,',
  'luxe':             'luxury brand photography, gold and black, marble,',
  'fun':              'playful cartoon, candy-colored palette, rounded shapes,',
}

/**
 * POST /api/preview-image
 *
 * @deprecated Use /api/stream-image instead — the two-phase preview+HD pipeline
 * has been removed in favor of single-pass schnell HD. This route is kept for
 * backward compatibility and now produces the same 8-step 1536×864 output as
 * /api/stream-image. Any new caller should use /api/stream-image directly.
 */
export async function POST(request: NextRequest) {
  // SECURITY: calls fal.ai flux/schnell (billable compute). Auth required.
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Route dépréciée (les nouveaux appels passent par stream-image) —
  // quota plus serré, suffisant pour les anciens clients par-scène.
  const limit = checkRateLimit('preview-image', user.id, 60)
  if (!limit.allowed) return rateLimitResponse(limit)

  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'prompt and style are required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { prompt, style, seed } = parsed.data

  try {
    // Scene content leads — flux weights the beginning of the prompt most heavily.
    // Style is appended as a suffix so it sets the aesthetic without overriding scene content.
    const suffix = STYLE_PREFIXES[style] ? STYLE_PREFIXES[style].replace(/,$/, '') : ''
    const fullPrompt = suffix ? `${prompt}, ${suffix}` : prompt

    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      // Explicit 16:9 dimensions aligned to final video target (1920x1080).
      // 1536x864 is exact 16:9 and both dims are multiples of 16 (required by
      // flux). Using this consistently across preview + HD + scene endpoints
      // ensures every scene is generated at the same aspect ratio, so
      // ffmpeg assembly never adds letterbox bars or inconsistent upscales.
      image_size: { width: 1536, height: 864 },
      // Bumped from 4 → 8 to match the single-pass HD standard in
      // /api/stream-image. Deprecated route, kept for backward compat only.
      num_inference_steps: 8,
      num_images: 1,
    }

    if (seed !== undefined) input.seed = seed

    // flux/schnell has no image-to-image variant — always use text-to-image for
    // the draft preview. Style reference is only applied in the HD pass (stream-image).
    const endpoint = 'fal-ai/flux/schnell'

    console.log(`[preview-image] Calling https://fal.run/${endpoint}`)

    const falRes = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const responseText = await falRes.text()
    console.log(`[preview-image] fal.ai status=${falRes.status}, body=${responseText.slice(0, 300)}`)

    if (!falRes.ok) {
      // Don't leak the upstream response body to the client — it can contain
      // account/quota details. Full detail stays in the server logs above.
      console.error(`[preview-image] fal.ai error status=${falRes.status}, body=${responseText.slice(0, 500)}`)
      return NextResponse.json(
        { error: 'Image generation failed', code: 'UPSTREAM_ERROR' },
        { status: 502 }
      )
    }

    const data = JSON.parse(responseText)
    const imageUrl = data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('[preview-image] No image URL in response:', responseText.slice(0, 500))
      return NextResponse.json({ error: 'No image returned from fal.ai' }, { status: 500 })
    }

    return NextResponse.json({ imageUrl, quality: 'draft' })
  } catch (err) {
    console.error('[preview-image] Exception:', err)
    return NextResponse.json({ error: 'Image generation failed', code: 'GENERATION_ERROR' }, { status: 500 })
  }
}
