import { createFalClient } from '@fal-ai/client'
import { logger } from '../lib/logger'

// Créer un client fal.ai typé avec la clé API
const fal = createFalClient({
  credentials: process.env.FAL_KEY,
})

const MAX_RETRIES = 1             // 1 retry max pour ne pas trop attendre
const TIMEOUT_IMAGE_MS = 60_000   // flux/dev: 20-40s — timeout strict pour fail fast
const TIMEOUT_VIDEO_MS = 180_000  // kling/lipsync: up to 3 min

// Configuration par style
interface StyleConfig {
  model: string
  prompt_prefix: string
  prompt_suffix: string
  image_size: string
  num_inference_steps: number
}

// ── Style configs ── All scene styles upgraded to flux/dev (PDF recommendation: quality > schnell for production)
const STYLE_CONFIGS: Record<string, StyleConfig> = {
  // Catégorie 1 — Narratif & Immersif
  cinematique: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain, deep shadows, golden hour, slow motion feel,',
    prompt_suffix: 'Hollywood production quality, color graded, epic composition, moody atmosphere',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  'stock-vo': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'National Geographic style, realistic textures, natural light, professional editorial stock photography, shallow depth of field, real-world documentary scene,',
    prompt_suffix: 'authentic documentary feel, high resolution, sharp focus, journalistic composition',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // Catégorie 2 — Explicatif & Didactique
  whiteboard: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'hand drawn sketch on whiteboard, black marker style, RSA Animate illustration, pure white background, no color fills, no textures,',
    prompt_suffix: 'educational explainer art, rough pen strokes, simple expressive shapes, whiteboard animation frame',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  // PDF canonical style — Bonshommes & Formes
  stickman: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'simple black line art on white background, minimalist stickman figures, bold geometric shapes, expressive stick characters, ultra clean linework, RSA animate style,',
    prompt_suffix: 'educational bonhommes illustration, no color fills, no gradients, pure line drawing, maximum legibility, symbolic storytelling',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  minimaliste: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'simple black line art, white background, minimalist stickman figures, stick figure illustration, ultra clean linework, no fills, no gradients,',
    prompt_suffix: 'educational diagram style, simple expressive stick characters, maximum legibility',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  // PDF canonical style — Illustration Plat
  'flat-design': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'flat design illustration, bold solid colors, clean geometric shapes, modern vector art, no shadows, no gradients, Dribbble-quality design, SVG-like aesthetic,',
    prompt_suffix: 'professional flat illustration, vibrant color palette, clear visual storytelling, modern digital design, no photorealism',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  infographie: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'modern flat infographic illustration, animated data visualization, bold color-coded sections, clean icons, isometric perspective, sans-serif labels,',
    prompt_suffix: 'information design, clear hierarchy, professional B2B report style, data-driven visual',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  // PDF canonical style — 3D Pixar / Claymation
  '3d-pixar': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'Pixar-style 3D CGI animation, claymation texture, adorable rounded characters, soft studio lighting, rich vibrant colors, depth of field, Disney Pixar movie quality,',
    prompt_suffix: '3D render, smooth surfaces, expressive facial features, cinematic composition, family-friendly warmth, photoreal CGI',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // Catégorie 3 — Design & Rythme
  'motion-graphics': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'flat design motion graphics, geometric shapes, vibrant vector colors, bold animated typography elements, kinetic composition, tech brand aesthetic,',
    prompt_suffix: 'high-end advertising quality, clean vector art, dynamic diagonal lines, modern UI feel',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  'animation-2d': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors, no photorealism, no 3D, traditional animation style,',
    prompt_suffix: 'studio quality animation frame, warm expressive characters, graphic novel aesthetic',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  // Motion Graphics styles
  corporate: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'clean corporate business illustration, navy blue and white palette, professional office setting, minimal geometric shapes, modern UI elements,',
    prompt_suffix: 'B2B brand aesthetic, trustworthy, Fortune 500 style',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  dynamique: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'high-energy dynamic composition, explosive motion blur, neon accent colors on dark background, diagonal lines, bold typography elements,',
    prompt_suffix: 'sports brand aesthetic, kinetic energy, powerful impact',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  luxe: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'ultra-luxury brand photography, gold and black palette, bokeh background, premium product on marble surface, elegant serif typography overlay,',
    prompt_suffix: 'high-fashion editorial, Vogue aesthetic, exclusive premium feel',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  fun: {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'playful cartoon illustration, candy-colored palette, bubbly rounded shapes, confetti, stickers, kawaii-inspired characters,',
    prompt_suffix: 'joyful cheerful energy, kids-friendly, Instagram-ready pop art',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
}

const DEFAULT_STYLE = STYLE_CONFIGS['stock-vo']

interface GenerateImageResult {
  imageUrl: string
  promptUsed: string
}

/**
 * Génère une image pour une scène avec le style donné
 * Utilise flux/dev pour la qualité de production (recommandation PDF)
 * Retry 2x en cas d'erreur — seed optionnel pour character consistency
 */
export interface BrandColors {
  primary_color: string
  secondary_color?: string | null
}

export async function generateSceneImage(
  prompt: string,
  style: string,
  seed?: number,
  brand?: BrandColors
): Promise<GenerateImageResult> {
  const styleConfig = STYLE_CONFIGS[style] ?? DEFAULT_STYLE
  // Brand color injection: append palette hint so fal.ai respects the brand palette
  const brandSuffix = brand
    ? `, color palette ${brand.primary_color}${brand.secondary_color ? ` and ${brand.secondary_color}` : ''}`
    : ''
  const fullPrompt = `${styleConfig.prompt_prefix} ${prompt}, ${styleConfig.prompt_suffix}${brandSuffix}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const startTime = Date.now()

      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        image_size: styleConfig.image_size,
        num_inference_steps: styleConfig.num_inference_steps,
        num_images: 1,
      }

      // Seed fixe = character consistency entre scènes (PDF: cref pattern)
      if (seed !== undefined) {
        input.seed = seed
      }

      const result = await Promise.race([
        fal.subscribe(styleConfig.model, { input }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fal.ai timeout')), TIMEOUT_IMAGE_MS)
        ),
      ])

      const duration = Date.now() - startTime
      const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
      const imageUrl = output.images?.[0]?.url

      if (!imageUrl) throw new Error('No image URL in fal.ai response')

      logger.info(
        { model: styleConfig.model, style, duration, attempt, hasSeed: seed !== undefined },
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
 * Génère les images pour toutes les scènes d'un storyboard en parallèle total.
 * fal.ai gère son propre queuing GPU — on envoie tout d'un coup pour minimiser la latence.
 * masterSeed optionnel: même seed sur toutes les scènes = character consistency (PDF cref pattern)
 */
export async function generateSceneImages(
  scenes: Array<{ id: string; description_visuelle: string }>,
  style: string,
  masterSeed?: number,
  brand?: BrandColors
): Promise<Array<{ sceneId: string; imageUrl: string; promptUsed: string }>> {
  // Toutes les scènes en parallèle — fal.ai distribue sur son cluster GPU
  const results = await Promise.all(
    scenes.map(async (scene) => {
      const { imageUrl, promptUsed } = await generateSceneImage(
        scene.description_visuelle,
        style,
        masterSeed,
        brand
      )
      return { sceneId: scene.id, imageUrl, promptUsed }
    })
  )

  return results
}

// ── Logo & Brand Asset generation ─────────────────────────────────────────────

const SOCIAL_FORMAT_MAP: Record<string, string> = {
  instagram_post:  'square_hd',
  instagram_story: 'portrait_16_9',
  linkedin:        'landscape_16_9',
  twitter:         'landscape_16_9',
  youtube_thumb:   'landscape_16_9',
  tiktok:          'portrait_16_9',
}

/**
 * Génère un logo / identité visuelle via flux/dev (qualité de production pour assets de marque)
 */
export async function generateLogo(
  prompt: string,
  brandColors?: BrandColors
): Promise<{ imageUrl: string }> {
  const colorContext = brandColors
    ? `, color palette ${brandColors.primary_color}${brandColors.secondary_color ? ` and ${brandColors.secondary_color}` : ''}`
    : ''

  const fullPrompt = `professional logo design, vector style, clean minimal branding, ${prompt}${colorContext}, white background, centered composition, no text unless specified, commercial quality`

  const result = await Promise.race([
    fal.subscribe('fal-ai/flux/dev', {
      input: { prompt: fullPrompt, image_size: 'square_hd', num_inference_steps: 28, num_images: 1 },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Logo generation timeout')), TIMEOUT_IMAGE_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
  const imageUrl = output.images?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in logo generation response')

  logger.info({ prompt: prompt.slice(0, 60) }, 'fal.ai: logo generated')
  return { imageUrl }
}

/**
 * Génère un visuel pour réseaux sociaux (post Instagram, bannière LinkedIn, story TikTok…)
 */
export async function generateSocialAsset(
  prompt: string,
  platform: string,
  brandColors?: BrandColors
): Promise<{ imageUrl: string }> {
  const imageSize = SOCIAL_FORMAT_MAP[platform] ?? 'square_hd'
  const colorContext = brandColors
    ? `, color palette ${brandColors.primary_color}${brandColors.secondary_color ? ` and ${brandColors.secondary_color}` : ''}`
    : ''

  const fullPrompt = `professional social media visual, ${platform.replace('_', ' ')} format, modern graphic design, ${prompt}${colorContext}, high quality, commercial advertising style`

  const result = await Promise.race([
    fal.subscribe('fal-ai/flux/dev', {
      input: { prompt: fullPrompt, image_size: imageSize as 'landscape_16_9' | 'square_hd' | 'portrait_16_9', num_inference_steps: 25, num_images: 1 },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Social asset generation timeout')), TIMEOUT_IMAGE_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
  const imageUrl = output.images?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in social asset generation response')

  logger.info({ platform, prompt: prompt.slice(0, 60) }, 'fal.ai: social asset generated')
  return { imageUrl }
}

// ── Image-to-Video / Lip-Sync ──────────────────────────────────────────────────

/**
 * Anime une image statique en vidéo courte via Kling v1.5 Pro (PDF recommendation)
 * image-to-video: donne du mouvement à chaque scène du storyboard
 */
export async function generateSceneVideo(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Kling i2v')

  const result = await Promise.race([
    fal.subscribe('fal-ai/kling-video/v1.5/pro/image-to-video', {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration,
        cfg_scale: 0.5,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Kling video timeout')), TIMEOUT_VIDEO_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } }
  const videoUrl = output.video?.url

  if (!videoUrl) throw new Error('No video URL in Kling response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Kling i2v complete')
  return { videoUrl }
}

/**
 * Synchronise les lèvres d'une vidéo avec une piste audio (PDF recommendation)
 * Utilise sync-lipsync/v2 pour un rendu naturel
 */
export async function generateLipSync(
  videoUrl: string,
  audioUrl: string
): Promise<{ videoUrl: string }> {
  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: starting lip-sync')

  const result = await Promise.race([
    fal.subscribe('fal-ai/sync-lipsync/v2', {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Lip-sync timeout')), TIMEOUT_VIDEO_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { video_url?: string; video?: { url: string } | string }
  const resultUrl =
    output.video_url ??
    (typeof output.video === 'string' ? output.video : output.video?.url)

  if (!resultUrl) throw new Error('No video URL in lip-sync response')

  logger.info({ resultUrl: resultUrl.slice(0, 60) }, 'fal.ai: lip-sync complete')
  return { videoUrl: resultUrl }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
