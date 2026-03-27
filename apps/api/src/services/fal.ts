import { createFalClient } from '@fal-ai/client'
import { logger } from '../lib/logger'

// Créer un client fal.ai typé avec la clé API
const fal = createFalClient({
  credentials: process.env.FAL_KEY,
})

const MAX_RETRIES = 2
const TIMEOUT_MS = 30_000

// Configuration par style — ARCHITECTURE.md section 4.3
interface StyleConfig {
  model: string
  prompt_prefix: string
  prompt_suffix: string
  image_size: string
}

const STYLE_CONFIGS: Record<string, StyleConfig> = {
  'animation-2d': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: '2D cartoon animation style, vibrant colors, clean lines,',
    prompt_suffix: 'professional animation, studio quality',
    image_size: 'landscape_16_9',
  },
  'stock-vo': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'professional stock photo style, realistic,',
    prompt_suffix: 'high quality photography, editorial',
    image_size: 'landscape_16_9',
  },
  minimaliste: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'minimalist design, clean white background, typography,',
    prompt_suffix: 'flat design, simple elegant',
    image_size: 'landscape_16_9',
  },
  infographie: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'infographic style, data visualization, icons,',
    prompt_suffix: 'clean design, informative',
    image_size: 'landscape_16_9',
  },
  whiteboard: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'whiteboard animation style, hand drawn, black marker on white,',
    prompt_suffix: 'educational illustration',
    image_size: 'landscape_16_9',
  },
  cinematique: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'cinematic photography, dramatic lighting, film grain,',
    prompt_suffix: '4K quality, professional cinematography',
    image_size: 'landscape_16_9',
  },
  // Motion Graphics styles
  corporate: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'corporate business style, professional, clean,',
    prompt_suffix: 'modern business aesthetic',
    image_size: 'landscape_16_9',
  },
  dynamique: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'dynamic energetic style, bold colors, action,',
    prompt_suffix: 'vibrant dynamic composition',
    image_size: 'landscape_16_9',
  },
  luxe: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'luxury premium style, gold accents, elegant,',
    prompt_suffix: 'high-end luxury aesthetic',
    image_size: 'landscape_16_9',
  },
  fun: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'fun playful style, bright colors, cartoon-like,',
    prompt_suffix: 'cheerful and engaging',
    image_size: 'landscape_16_9',
  },
}

const DEFAULT_STYLE = STYLE_CONFIGS['stock-vo']

interface GenerateImageResult {
  imageUrl: string
  promptUsed: string
}

/**
 * Génère une image pour une scène avec le style donné
 * Retry 2x en cas d'erreur, timeout 30s
 */
export async function generateSceneImage(
  prompt: string,
  style: string
): Promise<GenerateImageResult> {
  const styleConfig = STYLE_CONFIGS[style] ?? DEFAULT_STYLE
  const fullPrompt = `${styleConfig.prompt_prefix} ${prompt}, ${styleConfig.prompt_suffix}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const startTime = Date.now()

      const result = await Promise.race([
        fal.subscribe(styleConfig.model, {
          input: {
            prompt: fullPrompt,
            image_size: styleConfig.image_size,
            num_inference_steps: 4,
            num_images: 1,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fal.ai timeout')), TIMEOUT_MS)
        ),
      ])

      const duration = Date.now() - startTime

      // Extraire l'URL de l'image depuis la réponse fal.ai
      const output = result as { images?: Array<{ url: string }> }
      const imageUrl = output.images?.[0]?.url

      if (!imageUrl) {
        throw new Error('No image URL in fal.ai response')
      }

      logger.info(
        { model: styleConfig.model, style, duration, attempt },
        'fal.ai: image generated'
      )

      return { imageUrl, promptUsed: fullPrompt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, error: lastError.message, style },
        'fal.ai: image generation attempt failed'
      )

      if (attempt <= MAX_RETRIES) {
        await sleep(1000 * attempt)
      }
    }
  }

  logger.error({ error: lastError, style, prompt }, 'fal.ai: all attempts failed')
  throw new Error(`Image generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

/**
 * Génère les images pour toutes les scènes d'un storyboard
 * Les générations sont lancées en parallèle (max 3 concurrent)
 */
export async function generateSceneImages(
  scenes: Array<{ id: string; description_visuelle: string }>,
  style: string
): Promise<Array<{ sceneId: string; imageUrl: string; promptUsed: string }>> {
  const CONCURRENCY = 3
  const results: Array<{ sceneId: string; imageUrl: string; promptUsed: string }> = []

  // Traitement par batches pour éviter de surcharger l'API
  for (let i = 0; i < scenes.length; i += CONCURRENCY) {
    const batch = scenes.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const { imageUrl, promptUsed } = await generateSceneImage(
          scene.description_visuelle,
          style
        )
        return { sceneId: scene.id, imageUrl, promptUsed }
      })
    )

    results.push(...batchResults)
  }

  return results
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
