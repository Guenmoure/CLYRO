import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

// NOTE: prompts are now appended AFTER the scene description (style as suffix),
// so the scene composition leads and the style only sets the aesthetic.
// Prefixes describe AESTHETIC, not COMPOSITION — composition belongs to the scene.
const STYLE_CONFIGS: Record<string, { model: string; prefix: string }> = {
  'cinematique':     { model: 'fal-ai/flux/dev', prefix: 'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain, golden hour' },
  'stock-vo':        { model: 'fal-ai/flux/dev', prefix: 'realistic cinematic photograph, professional lighting, Canon 5D, 4K ultra-detailed' },
  'whiteboard':      { model: 'fal-ai/flux/dev', prefix: 'whiteboard animation style, black ink hand-drawn illustration on white background, sketch style, educational' },
  'stickman':        { model: 'fal-ai/flux/dev', prefix: 'hand-drawn black ink stick figure illustration on white paper, simple line drawing, minimalist cartoon style, bold expressive strokes' },
  'flat-design':     { model: 'fal-ai/flux/dev', prefix: 'flat design illustration, vibrant colors, geometric shapes, material design style, clean vector art' },
  '3d-pixar':        { model: 'fal-ai/flux/dev', prefix: '3D Pixar animation style, subsurface scattering, warm lighting, expressive characters, cinematic render' },
  'minimaliste':     { model: 'fal-ai/flux/dev', prefix: 'minimalist design, clean white background, bold typography, geometric shapes, Bauhaus style' },
  'infographie':     { model: 'fal-ai/flux/dev', prefix: 'animated infographic illustration, data visualization icons, flat vector style, information design, bold colors' },
  'motion-graphics': { model: 'fal-ai/flux/dev', prefix: 'motion graphics design, abstract geometric animation, gradient colors, dynamic composition, After Effects style' },
  'animation-2d':    { model: 'fal-ai/flux/dev', prefix: 'cartoon 2D flat animation, vibrant colors, expressive characters, anime-influenced, smooth cel-shading' },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { prompt: string; style: string }
    const { prompt, style } = body

    if (!prompt || !style) {
      return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const config = STYLE_CONFIGS[style] ?? STYLE_CONFIGS['cinematique']
    // Scene description leads — Flux weights the beginning of the prompt most.
    // Style is a suffix so the aesthetic is applied without overriding composition.
    const fullPrompt = `${prompt}, ${config.prefix}`

    // Random seed so each call varies — caller can supply their own seed later if needed.
    const seed = Math.floor(Math.random() * 1_000_000_000)

    const result = await fal.run(config.model, {
      input: {
        prompt: fullPrompt,
        // Explicit 16:9 dimensions aligned to final video target — see
        // preview-image/stream-image for rationale. Using the exact same
        // size across all three endpoints is what guarantees the video
        // assembly never letterboxes or upscales inconsistently.
        image_size: { width: 1536, height: 864 },
        num_inference_steps: 24,
        num_images: 1,
        enable_safety_checker: true,
        seed,
      },
    }) as unknown as { data?: { images: Array<{ url: string }> }; images?: Array<{ url: string }> }

    const imageUrl = (result.data ?? result).images?.[0]?.url
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image returned from FAL' }, { status: 500 })
    }

    return NextResponse.json({ imageUrl })
  } catch (err) {
    console.error('[generate-scene-image]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 }
    )
  }
}
