import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 min — Kling Standard ~45-90s, Pro ~2-3min

// Styles premium qui méritent Kling Pro (plus cher, plus qualitatif)
const PREMIUM_STYLES = new Set(['cinematique', 'stock-vo', 'luxe', '3d-pixar'])

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const body = await request.json() as {
      imageUrl?: string
      image_url?: string
      animationPrompt?: string
      animation_prompt?: string
      duration?: '5' | '10'
      style?: string
    }
    const imageUrl = body.imageUrl ?? body.image_url
    const animationPrompt = body.animationPrompt ?? body.animation_prompt
    const duration = body.duration ?? '5'
    const style = body.style ?? ''

    if (!imageUrl || !animationPrompt) {
      return NextResponse.json({ error: 'imageUrl and animationPrompt are required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    // Par défaut : Kling Standard (0.017$/sec, plus rapide)
    // Pro uniquement pour les styles premium
    const usePro = PREMIUM_STYLES.has(style)
    const endpoint = usePro
      ? 'fal-ai/kling-video/v1.5/pro/image-to-video'
      : 'fal-ai/kling-video/v1/standard/image-to-video'

    console.log(`[generate-scene-clip] Using ${usePro ? 'Pro' : 'Standard'} Kling, duration=${duration}s`)

    // Timeout explicite (5 min pour Standard, 8 min pour Pro)
    const timeoutMs = usePro ? 8 * 60 * 1000 : 5 * 60 * 1000
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
        return NextResponse.json(
          { error: `fal.ai ${falRes.status}: ${responseText.slice(0, 200)}` },
          { status: falRes.status === 401 ? 401 : 502 }
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
        model: usePro ? 'kling-pro' : 'kling-standard',
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
    const msg = err instanceof Error ? err.message : 'Clip generation failed'
    console.error('[generate-scene-clip] uncaught:', msg, err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
