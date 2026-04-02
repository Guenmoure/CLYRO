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
    prompt_prefix: 'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors, no photorealism, no 3D, anime-influenced,',
    prompt_suffix: 'studio quality animation frame, clean composition, graphic novel aesthetic',
    image_size: 'landscape_16_9',
  },
  'stock-vo': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'professional editorial stock photography, natural soft lighting, Canon EOS R5, shallow depth of field, real-world setting,',
    prompt_suffix: 'high resolution, sharp focus, authentic documentary feel',
    image_size: 'landscape_16_9',
  },
  minimaliste: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'extreme minimalist composition, pure white background, single centered subject, heavy negative space, Swiss grid design, Helvetica aesthetic,',
    prompt_suffix: 'flat design, monochrome or duotone palette, no clutter, no shadows',
    image_size: 'landscape_16_9',
  },
  infographie: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'modern flat infographic illustration, icon set, data visualization, bold color-coded sections, clean sans-serif labels, isometric perspective,',
    prompt_suffix: 'information design, clear hierarchy, white background, professional report style',
    image_size: 'landscape_16_9',
  },
  whiteboard: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'RSA Animate whiteboard drawing, black thick marker lines on pure white background, hand-drawn sketch illustration, no color fills, no textures,',
    prompt_suffix: 'educational explainer art, rough pen strokes, simple expressive shapes',
    image_size: 'landscape_16_9',
  },
  cinematique: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'anamorphic cinematic wide shot, dramatic chiaroscuro lighting, 35mm film grain, deep shadows, golden hour or blue hour, moody atmospheric,',
    prompt_suffix: 'Hollywood production quality, color graded, lens flares, epic composition',
    image_size: 'landscape_16_9',
  },
  // Motion Graphics styles
  corporate: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'clean corporate business illustration, navy blue and white palette, professional office setting, minimal geometric shapes, modern UI elements,',
    prompt_suffix: 'B2B brand aesthetic, trustworthy, Fortune 500 style',
    image_size: 'landscape_16_9',
  },
  dynamique: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'high-energy dynamic composition, explosive motion blur, neon accent colors on dark background, diagonal lines, bold typography elements,',
    prompt_suffix: 'sports brand aesthetic, kinetic energy, powerful impact',
    image_size: 'landscape_16_9',
  },
  luxe: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'ultra-luxury brand photography, gold and black palette, bokeh background, premium product on marble surface, elegant serif typography overlay,',
    prompt_suffix: 'high-fashion editorial, Vogue aesthetic, exclusive premium feel',
    image_size: 'landscape_16_9',
  },
  fun: {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'playful cartoon illustration, candy-colored palette, bubbly rounded shapes, confetti, stickers, kawaii-inspired characters,',
    prompt_suffix: 'joyful cheerful energy, kids-friendly, Instagram-ready pop art',
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
      const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
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
