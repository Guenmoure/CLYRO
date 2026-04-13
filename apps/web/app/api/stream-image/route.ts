import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const STYLE_CONFIGS: Record<string, { model: string; prefix: string }> = {
  'cinematique':     { model: 'fal-ai/flux/dev', prefix: 'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain,' },
  'stock-vo':        { model: 'fal-ai/flux/dev', prefix: 'realistic cinematic photograph, professional lighting, Canon 5D, 4K ultra-detailed,' },
  'whiteboard':      { model: 'fal-ai/flux/dev', prefix: 'whiteboard animation style, black ink hand-drawn illustration on white background, sketch style, educational,' },
  'stickman':        { model: 'fal-ai/flux/dev', prefix: 'simple stickman animation, black and white line art, minimalist cartoon, expressive poses,' },
  'flat-design':     { model: 'fal-ai/flux/dev', prefix: 'flat design illustration, vibrant colors, geometric shapes, material design style, clean vector art,' },
  '3d-pixar':        { model: 'fal-ai/flux/dev', prefix: '3D Pixar animation style, subsurface scattering, warm lighting, expressive characters, cinematic render,' },
  'minimaliste':     { model: 'fal-ai/flux/dev', prefix: 'minimalist design, clean white background, bold typography, geometric shapes, Bauhaus style,' },
  'infographie':     { model: 'fal-ai/flux/dev', prefix: 'animated infographic illustration, data visualization icons, flat vector style, information design, bold colors,' },
  'motion-graphics': { model: 'fal-ai/flux/dev', prefix: 'motion graphics design, abstract geometric animation, gradient colors, dynamic composition, After Effects style,' },
  'animation-2d':    { model: 'fal-ai/flux/dev', prefix: 'cartoon 2D flat animation, vibrant colors, expressive characters, anime-influenced, smooth cel-shading,' },
}

/**
 * POST /api/stream-image
 * HD image generation using fal.run() (blocking, reliable on Vercel serverless).
 * Replaces the previous SSE streaming approach which was unreliable on serverless.
 *
 * Body: { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
 * Response: { imageUrl: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }
  console.log(`[stream-image] FAL_KEY loaded: ${falKey.slice(0, 6)}...${falKey.slice(-4)} (${falKey.length} chars)`)

  const body = await request.json() as { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
  const { prompt, style, seed, styleReferenceUrl } = body

  if (!prompt || !style) {
    return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
  }

  const falClient = createFalClient({ credentials: falKey })
  const config = STYLE_CONFIGS[style] ?? STYLE_CONFIGS['cinematique']
  const fullPrompt = `${config.prefix} ${prompt}`

  try {
    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 28,
      num_images: 1,
      enable_safety_checker: true,
    }

    if (seed !== undefined) {
      input.seed = seed
    }

    // Use style reference for scenes 1..N (image-to-image)
    let model = config.model
    if (styleReferenceUrl) {
      input.image_url = styleReferenceUrl
      input.strength = 0.72
      model = 'fal-ai/flux/dev/image-to-image'
    }

    console.log(`[stream-image] Generating with model=${model}, style=${style}, seed=${seed}, hasRef=${!!styleReferenceUrl}`)

    const result = await falClient.run(model, {
      input,
    }) as unknown as { data?: { images: Array<{ url: string }> }; images?: Array<{ url: string }> }

    const imageUrl = (result.data ?? result).images?.[0]?.url

    if (!imageUrl) {
      console.error('[stream-image] No image in fal.ai response:', JSON.stringify(result).slice(0, 500))
      return NextResponse.json({ error: 'No image returned from fal.ai' }, { status: 500 })
    }

    console.log(`[stream-image] Success: ${imageUrl.slice(0, 80)}...`)
    return NextResponse.json({ imageUrl })
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 500
    const body = err?.body ?? err?.response?.data ?? null
    const message = err instanceof Error ? err.message : 'HD generation failed'
    console.error('[stream-image] Error:', { status, message, body: JSON.stringify(body)?.slice(0, 300) })
    return NextResponse.json({ error: `fal.ai ${status}: ${message}`, detail: body }, { status: 500 })
  }
}
