import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

const bodySchema = z.object({
  imageUrl: z.string().url().optional(),
  image_url: z.string().url().optional(),
  animationPrompt: z.string().min(1).optional(),
  animation_prompt: z.string().min(1).optional(),
  duration: z.enum(['5', '10']).optional(),
  style: z.string().optional(),
})

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 min — Kling v2.5-turbo Standard ~20-40s, Pro ~40-90s

// Styles premium qui méritent Kling Pro (plus cher, plus qualitatif)
const PREMIUM_STYLES = new Set(['cinematique', 'stock-vo', 'luxe', '3d-pixar'])

export async function POST(request: NextRequest) {
  // Auth check — getUser() revalidates the JWT against the Supabase Auth
  // server, unlike getSession() which only reads the local cookie.
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Kling v2.5-turbo (Pro pour les styles premium) est l'appel fal.ai le
  // plus cher de l'app → quota le plus serré.
  const limit = checkRateLimit('generate-scene-clip', user.id, 10)
  if (!limit.allowed) return rateLimitResponse(limit)

  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'imageUrl and animationPrompt are required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const body = parsed.data
    const imageUrl = body.imageUrl ?? body.image_url
    const animationPrompt = body.animationPrompt ?? body.animation_prompt
    const duration = body.duration ?? '5'
    const style = body.style ?? ''

    if (!imageUrl || !animationPrompt) {
      return NextResponse.json({ error: 'imageUrl and animationPrompt are required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    // Par défaut : Kling v2.5-turbo Standard (~20-40s, ~2× plus rapide que v1)
    // Pro uniquement pour les styles premium (~40-90s vs 90-180s pour v1.5 pro)
    const usePro = PREMIUM_STYLES.has(style)
    const endpoint = usePro
      ? 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'
      : 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video'

    console.log(`[generate-scene-clip] Using Kling v2.5-turbo ${usePro ? 'Pro' : 'Standard'}, duration=${duration}s`)

    // Timeout explicite (3 min pour Standard, 5 min pour Pro — turbo is faster)
    const timeoutMs = usePro ? 5 * 60 * 1000 : 3 * 60 * 1000
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const falRes = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: animationPrompt,
          duration,
          cfg_scale: 0.5,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const responseText = await falRes.text()
      console.log(`[generate-scene-clip] fal.ai status=${falRes.status}, body=${responseText.slice(0, 200)}`)

      if (!falRes.ok) {
        // Don't leak the upstream response body to the client — it can
        // contain account/quota details. Detail stays in server logs above.
        console.error(`[generate-scene-clip] fal.ai error status=${falRes.status}, body=${responseText.slice(0, 500)}`)
        return NextResponse.json(
          { error: 'Clip generation failed', code: 'UPSTREAM_ERROR' },
          { status: 502 }
        )
      }

      let data: { video?: { url?: string } } & Record<string, unknown>
      try {
        data = JSON.parse(responseText)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON from fal.ai' }, { status: 502 })
      }

      const videoUrl = data?.video?.url
      if (!videoUrl || typeof videoUrl !== 'string') {
        return NextResponse.json({ error: 'No video URL returned from model' }, { status: 502 })
      }

      return NextResponse.json({
        videoUrl,
        model: usePro ? 'kling-v2.5-turbo-pro' : 'kling-v2.5-turbo-standard',
      })
    } catch (fetchErr) {
      clearTimeout(timeout)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return NextResponse.json(
          { error: `Timeout après ${timeoutMs / 1000}s — fal.ai n'a pas répondu à temps` },
          { status: 504 }
        )
      }
      throw fetchErr
    }
  } catch (err) {
    console.error('[generate-scene-clip] uncaught:', err)
    return NextResponse.json({ error: 'Clip generation failed', code: 'GENERATION_ERROR' }, { status: 500 })
  }
}
