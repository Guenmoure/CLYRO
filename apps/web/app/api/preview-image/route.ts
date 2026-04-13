import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STYLE_PREFIXES: Record<string, string> = {
  'cinematique':      'cinematic lighting, dramatic composition, film grain,',
  'stock-vo':         'realistic photograph, natural light, documentary style,',
  'whiteboard':       'hand-drawn whiteboard sketch, black marker on white,',
  'stickman':         'stick figure black line art on white background,',
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
 * Fast draft preview using flux/schnell (4 inference steps, ~3-4s).
 * Used as the first pass before the full HD stream-image call.
 *
 * Body: { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
 * Response: { imageUrl: string; quality: 'draft' }
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }
  console.log(`[preview-image] FAL_KEY loaded: ${falKey.slice(0, 6)}...${falKey.slice(-4)} (${falKey.length} chars)`)

  const body = await request.json() as { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
  const { prompt, style, seed, styleReferenceUrl } = body

  if (!prompt || !style) {
    return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
  }

  try {
    // Create client inline to ensure fresh env var is used
    const falClient = createFalClient({ credentials: falKey })
    const prefix = STYLE_PREFIXES[style] ?? ''
    const fullPrompt = `${prefix} ${prompt}`

    // Use style reference image for consistent styling (image-to-image).
    // fal.ai: strength=0 → copy reference, strength=1 → free generation from prompt.
    // 0.72 = 72% prompt freedom + 28% visual anchor.
    if (styleReferenceUrl) {
      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        image_url: styleReferenceUrl,
        strength: 0.72,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
      }

      // Add deterministic seed for visual consistency
      if (seed !== undefined) {
        input.seed = seed
      }

      const result = await falClient.run('fal-ai/flux/schnell/image-to-image', {
        input,
      }) as unknown as { data?: { images: Array<{ url: string }> }; images?: Array<{ url: string }> }

      const imageUrl = (result.data ?? result).images?.[0]?.url
      if (!imageUrl) throw new Error('No image returned from flux/schnell img2img')

      return NextResponse.json({ imageUrl, quality: 'draft' })
    } else {
      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
      }

      // Add deterministic seed for visual consistency
      if (seed !== undefined) {
        input.seed = seed
      }

      const result = await falClient.run('fal-ai/flux/schnell', {
        input: input as any,
      }) as unknown as { data?: { images: Array<{ url: string }> }; images?: Array<{ url: string }> }

      const imageUrl = (result.data ?? result).images?.[0]?.url
      if (!imageUrl) throw new Error('No image returned from flux/schnell')

      return NextResponse.json({ imageUrl, quality: 'draft' })
    }
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 500
    const body = err?.body ?? err?.response?.data ?? null
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    console.error('[preview-image]', { status, message, body: JSON.stringify(body)?.slice(0, 300) })
    return NextResponse.json(
      { error: `fal.ai ${status}: ${message}`, detail: body },
      { status: 500 }
    )
  }
}
