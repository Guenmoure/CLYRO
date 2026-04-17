import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STYLE_PREFIXES: Record<string, string> = {
  'cinematique':      'cinematic lighting, dramatic composition, film grain,',
  'stock-vo':         'realistic photograph, natural light, documentary style,',
  'whiteboard':       'hand-drawn whiteboard sketch, black marker on white,',
  'stickman':         'bold black stick figure, pure white background, thick lines, centered composition, large iconic pose, RSA animate style, no color,',
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
 * Uses direct fetch to fal.ai REST API (no SDK dependency).
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const body = await request.json() as {
    prompt: string; style: string; seed?: number; styleReferenceUrl?: string
  }
  const { prompt, style, seed, styleReferenceUrl } = body

  if (!prompt || !style) {
    return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
  }

  try {
    const prefix = STYLE_PREFIXES[style] ?? ''
    const fullPrompt = `${prefix} ${prompt}`

    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
    }

    if (seed !== undefined) input.seed = seed

    let endpoint = 'fal-ai/flux/schnell'

    if (styleReferenceUrl) {
      input.image_url = styleReferenceUrl
      input.strength = 0.72
      endpoint = 'fal-ai/flux/schnell/image-to-image'
    }

    console.log(`[preview-image] Calling https://fal.run/${endpoint}, key=${falKey.slice(0, 6)}...${falKey.slice(-4)}`)

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
      return NextResponse.json(
        { error: `fal.ai ${falRes.status}: ${responseText.slice(0, 200)}` },
        { status: 500 }
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
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    console.error('[preview-image] Exception:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
