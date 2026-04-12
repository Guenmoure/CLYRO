import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

const fal = createFalClient({ credentials: process.env.FAL_KEY })

const WAN_KEYWORDS = ['fast', 'dynamic', 'explosion', 'action', 'rapid', 'energetic', 'running', 'jumping', 'flying', 'spinning', 'burst', 'flash']

function shouldUseWan(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return WAN_KEYWORDS.some((kw) => lower.includes(kw))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      imageUrl?: string
      image_url?: string
      animationPrompt?: string
      animation_prompt?: string
      duration?: '5' | '10'
    }
    const imageUrl = body.imageUrl ?? body.image_url
    const animationPrompt = body.animationPrompt ?? body.animation_prompt
    const duration = body.duration ?? '5'

    if (!imageUrl || !animationPrompt) {
      return NextResponse.json({ error: 'imageUrl and animationPrompt are required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    let videoUrl: string | undefined
    let modelUsed: string

    if (shouldUseWan(animationPrompt)) {
      try {
        const result = await fal.run('fal-ai/wan/v2.2/image-to-video', {
          input: {
            image_url: imageUrl,
            prompt: animationPrompt,
            num_frames: duration === '10' ? 240 : 120,
            guidance_scale: 5.0,
          },
        }) as any
        videoUrl = (result.data ?? result)?.video?.url ?? (result.data ?? result)?.video_url
        modelUsed = 'wan'
      } catch {
        // fallback to Kling below
      }
    }

    if (!videoUrl) {
      const result = await fal.run('fal-ai/kling-video/v1.5/pro/image-to-video', {
        input: {
          image_url: imageUrl,
          prompt: animationPrompt,
          duration,
          cfg_scale: 0.5,
        },
      }) as any
      videoUrl = (result.data ?? result)?.video?.url
      modelUsed = 'kling'
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'No video URL returned from model' }, { status: 500 })
    }

    return NextResponse.json({ videoUrl, model: modelUsed! })
  } catch (err) {
    console.error('[generate-scene-clip]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Clip generation failed' },
      { status: 500 }
    )
  }
}
