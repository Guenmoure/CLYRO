import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

const fal = createFalClient({ credentials: process.env.FAL_KEY })

const STYLE_CONFIGS: Record<string, { model: string; prefix: string }> = {
  'cinematique':     { model: 'fal-ai/flux/dev', prefix: 'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain, golden hour,' },
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
    const fullPrompt = `${config.prefix} ${prompt}`

    const result = await fal.run(config.model, {
      input: {
        prompt: fullPrompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 24,
        num_images: 1,
        enable_safety_checker: true,
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
