import { NextRequest, NextResponse } from 'next/server'

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
  const { prompt, style, seed } = body

  if (!prompt || !style) {
    return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
  }

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
      num_inference_steps: 4,
      num_images: 1,
    }

    if (seed !== undefined) input.seed = seed

    // flux/schnell has no image-to-image variant — always use text-to-image for
    // the draft preview. Style reference is only applied in the HD pass (stream-image).
    const endpoint = 'fal-ai/flux/schnell'

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
