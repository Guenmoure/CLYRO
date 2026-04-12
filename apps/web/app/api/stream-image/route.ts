import { NextRequest } from 'next/server'
import { createFalClient } from '@fal-ai/client'

const fal = createFalClient({ credentials: process.env.FAL_KEY })

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
 * Streams fal.ai image generation progress as Server-Sent Events.
 *
 * Body: { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
 * Events:
 *   data: {"type":"log","message":"..."}          — generation log line
 *   data: {"type":"progress","pct":42}            — percentage estimate
 *   data: {"type":"done","imageUrl":"https://..."}— final result
 *   data: {"type":"error","message":"..."}        — failure
 */
export async function POST(request: NextRequest) {
  if (!process.env.FAL_KEY) {
    return new Response('FAL_KEY not configured', { status: 500 })
  }

  const body = await request.json() as { prompt: string; style: string; seed?: number; styleReferenceUrl?: string }
  const { prompt, style, seed, styleReferenceUrl } = body

  if (!prompt || !style) {
    return new Response('prompt and style are required', { status: 400 })
  }

  const config = STYLE_CONFIGS[style] ?? STYLE_CONFIGS['cinematique']
  const fullPrompt = `${config.prefix} ${prompt}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        const input: Record<string, unknown> = {
          prompt: fullPrompt,
          image_size: 'landscape_16_9',
          num_inference_steps: 28,
          num_images: 1,
          enable_safety_checker: true,
        }

        // Add deterministic seed for visual consistency
        if (seed !== undefined) {
          input.seed = seed
        }

        // Use style reference image for consistent styling (image-to-image).
        // fal.ai convention: strength=0 → copy reference, strength=1 → ignore reference (free generation).
        // 0.72 = 72% prompt freedom + 28% visual anchor (palette, lighting, mood).
        let model = config.model
        if (styleReferenceUrl) {
          input.image_url = styleReferenceUrl
          input.strength = 0.72
          model = 'fal-ai/flux/dev/image-to-image'
        }

        // fal.stream() returns a Promise<FalStream> — must be awaited before iterating
        const falStream = await fal.stream(model, {
          input,
        })

        let logCount = 0
        // Consume the stream for log progress events
        for await (const partial of falStream) {
          const logs = (partial as { logs?: Array<{ message: string }> }).logs
          if (logs && logs.length > logCount) {
            const newLogs = logs.slice(logCount)
            for (const log of newLogs) {
              send({ type: 'log', message: log.message })
            }
            logCount = logs.length
            // Estimate progress: flux-dev runs ~28 steps; logs ≈ 1 per step
            send({ type: 'progress', pct: Math.min(90, Math.round((logCount / 28) * 90)) })
          }
        }

        // Get the final completed result
        const result = await falStream.done() as
          | { images: Array<{ url: string }> }
          | { data: { images: Array<{ url: string }> } }

        const images = ('data' in result ? result.data.images : result.images)
        const imageUrl = images?.[0]?.url

        if (!imageUrl) throw new Error('No image returned from fal.ai')

        send({ type: 'progress', pct: 100 })
        send({ type: 'done', imageUrl })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Generation failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
