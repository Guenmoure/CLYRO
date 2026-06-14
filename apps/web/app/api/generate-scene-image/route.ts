import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createFalClient } from '@fal-ai/client'
import { applyAntiHallucination } from '@clyro/shared'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

// Style prefixes only — all styles now use fal-ai/flux/schnell in single-pass HD.
// See stream-image/route.ts for the rationale (removal of the two-phase schnell
// preview + flux/dev HD pipeline).
const STYLE_PREFIXES: Record<string, string> = {
  'cinematique':     'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain, golden hour',
  'stock-vo':        'realistic cinematic photograph, professional lighting, Canon 5D, 4K ultra-detailed',
  'whiteboard':      'whiteboard animation style, black ink hand-drawn illustration on white background, sketch style, educational',
  'stickman':        'hand-drawn black ink stick figure illustration on white paper, simple line drawing, minimalist cartoon style, bold expressive strokes',
  'flat-design':     'flat design illustration, vibrant colors, geometric shapes, material design style, clean vector art',
  '3d-pixar':        '3D Pixar animation style, subsurface scattering, warm lighting, expressive characters, cinematic render',
  'minimaliste':     'minimalist design, clean white background, bold typography, geometric shapes, Bauhaus style',
  'infographie':     'animated infographic illustration, data visualization icons, flat vector style, information design, bold colors',
  'motion-graphics': 'motion graphics design, abstract geometric animation, gradient colors, dynamic composition, After Effects style',
  'animation-2d':    'cartoon 2D flat animation, vibrant colors, expressive characters, anime-influenced, smooth cel-shading',
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: calls fal.ai flux/schnell. Auth required to keep the
    // FAL_KEY balance from being burned by anonymous loops.
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // flux/schnell est bon marché mais ce bouton "régénérer" peut être
    // spammé — quota intermédiaire.
    const limit = checkRateLimit('generate-scene-image', user.id, 60)
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await request.json() as { prompt: string; style: string }
    const { prompt, style } = body

    if (!prompt || !style) {
      return NextResponse.json({ error: 'prompt and style are required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const prefix = STYLE_PREFIXES[style] ?? STYLE_PREFIXES['cinematique']
    // Apply the anti-hallucination safety net (no-text suffix + style
    // lock) BEFORE the per-style prefix is appended — guarantees the
    // negatives reach Flux even when this endpoint is called directly
    // from the wizard's "regenerate scene" button.
    const safePrompt = applyAntiHallucination(prompt, style)
    // Scene description leads — Flux weights the beginning of the prompt most.
    // Style is a suffix so the aesthetic is applied without overriding composition.
    const fullPrompt = `${safePrompt}, ${prefix}`

    // Random seed so each call varies — caller can supply their own seed later if needed.
    const seed = Math.floor(Math.random() * 1_000_000_000)

    const result = await fal.run('fal-ai/flux/schnell', {
      input: {
        prompt: fullPrompt,
        // Explicit 16:9 dimensions aligned to final video target (1920×1080).
        image_size: { width: 1536, height: 864 },
        // 8 is the max useful inference steps for flux/schnell.
        num_inference_steps: 8,
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
      { error: 'Image generation failed', code: 'GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
