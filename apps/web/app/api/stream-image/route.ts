import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Single-pass image generation with fal-ai/flux/schnell at HD dimensions (1536×864, 8 steps).
// Previously we ran a two-phase pipeline (schnell preview → flux/dev HD) but the swap caused:
//  - 2× fal.ai requests → hit the 10-concurrent cap at 40+ scenes
//  - A visible flash when the HD image replaced the preview
//  - Occasional blank/blurry outputs when flux/dev converged poorly with heavy negative prompts
// Single-pass schnell at 8 steps is the fastest config that still produces clean HD output.
const STYLE_PREFIXES: Record<string, string> = {
  'cinematique':     'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain,',
  'stock-vo':        'realistic cinematic photograph, professional lighting, Canon 5D, 4K ultra-detailed,',
  'whiteboard':      'whiteboard animation style, black ink hand-drawn illustration on white background, sketch style, educational,',
  'stickman':        'hand-drawn black ink stick figure illustration on white paper, simple line drawing, minimalist cartoon style, bold expressive strokes,',
  'flat-design':     'flat design illustration, vibrant colors, geometric shapes, material design style, clean vector art,',
  '3d-pixar':        '3D Pixar animation style, subsurface scattering, warm lighting, expressive characters, cinematic render,',
  'minimaliste':     'minimalist design, clean white background, bold typography, geometric shapes, Bauhaus style,',
  'infographie':     'animated infographic illustration, data visualization icons, flat vector style, information design, bold colors,',
  'motion-graphics': 'motion graphics design, abstract geometric animation, gradient colors, dynamic composition, After Effects style,',
  'animation-2d':    'cartoon 2D flat animation, vibrant colors, expressive characters, anime-influenced, smooth cel-shading,',
}

/**
 * POST /api/stream-image
 * Single-pass HD image generation via fal-ai/flux/schnell at 1536×864 / 8 steps.
 * styleReferenceUrl is ignored (schnell has no image-to-image variant — style
 * consistency is enforced via styleTokens injected into the text prompt).
 *
 * Body: { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
 * Response: { imageUrl: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const body = await request.json() as {
    prompt: string; style: string; seed?: number; styleReferenceUrl?: string
  }
  const { prompt, style, seed } = body

  if (!prompt || !style) {
    return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
  }

  const styleSuffix = (STYLE_PREFIXES[style] ?? STYLE_PREFIXES['cinematique']).replace(/,$/, '')
  const fullPrompt = `${prompt}, ${styleSuffix}`

  try {
    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      // Explicit 16:9 dimensions aligned to final video target (1920×1080).
      // 1536×864 is exact 16:9 and both dims are multiples of 16 (flux req).
      image_size: { width: 1536, height: 864 },
      // 8 is the max useful inference steps for flux/schnell — beyond that
      // quality plateaus and latency grows. Gives visibly sharper output than
      // the default 4 steps while keeping per-image latency under ~4-5s.
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
    }

    if (seed !== undefined) input.seed = seed

    const endpoint = 'fal-ai/flux/schnell'

    console.log(`[stream-image] Calling https://fal.run/${endpoint}, style=${style}, seed=${seed}, key=${falKey.slice(0, 6)}...${falKey.slice(-4)}`)

    const falRes = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const responseText = await falRes.text()
    console.log(`[stream-image] fal.ai status=${falRes.status}, body=${responseText.slice(0, 300)}`)

    if (!falRes.ok) {
      return NextResponse.json(
        { error: `fal.ai ${falRes.status}: ${responseText.slice(0, 200)}` },
        { status: 500 }
      )
    }

    const data = JSON.parse(responseText)
    const imageUrl = data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('[stream-image] No image URL in response:', responseText.slice(0, 500))
      return NextResponse.json({ error: 'No image returned from fal.ai' }, { status: 500 })
    }

    console.log(`[stream-image] Success: ${imageUrl.slice(0, 80)}...`)
    return NextResponse.json({ imageUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'HD generation failed'
    console.error('[stream-image] Exception:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
