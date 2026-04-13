import { createFalClient } from '@fal-ai/client'
import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'
import { selectFalModelForF1Style } from '../config/fal-models'

// Créer un client fal.ai typé avec la clé API
const fal = createFalClient({
  credentials: process.env.FAL_KEY,
})

const MAX_RETRIES = 1             // 1 retry avant fallback schnell (fail fast)

// Models that use aspect_ratio instead of image_size
const ASPECT_RATIO_MODELS = new Set([
  'fal-ai/flux-pro/v1.1-ultra',
  'fal-ai/flux-pro',
  'fal-ai/ideogram/v2',
])

const IMAGE_SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  'landscape_16_9': '16:9',
  'square_hd': '1:1',
  'portrait_16_9': '9:16',
}
const TIMEOUT_IMAGE_MS = 120_000  // flux/dev: 20-90s depending on queue load
const TIMEOUT_VIDEO_MS = 90_000   // kling standard: ~30-60s — réduit de 180s pour fail-fast

// Configuration par style
interface StyleConfig {
  prompt_prefix: string
  prompt_suffix: string
  image_size: string
  num_inference_steps: number
}

// ── Style configs ── Model selection is handled by selectFalModelForF1Style() in fal-models.ts
const STYLE_CONFIGS: Record<string, StyleConfig> = {
  // Catégorie 1 — Narratif & Immersif
  cinematique: {
    prompt_prefix: 'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain, deep shadows, golden hour, slow motion feel,',
    prompt_suffix: 'Hollywood production quality, color graded, epic composition, moody atmosphere',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  'stock-vo': {
    prompt_prefix: 'National Geographic style, realistic textures, natural light, professional editorial stock photography, shallow depth of field, real-world documentary scene,',
    prompt_suffix: 'authentic documentary feel, high resolution, sharp focus, journalistic composition',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // Catégorie 2 — Explicatif & Didactique
  whiteboard: {
    prompt_prefix: 'hand drawn sketch on whiteboard, black marker style, RSA Animate illustration, pure white background, no color fills, no textures,',
    prompt_suffix: 'educational explainer art, rough pen strokes, simple expressive shapes, whiteboard animation frame',
    image_size: 'landscape_16_9',
    num_inference_steps: 20,
  },
  // PDF canonical style — Bonshommes & Formes
  stickman: {
    prompt_prefix: 'simple black line art on white background, minimalist stickman figures, bold geometric shapes, expressive stick characters, ultra clean linework, RSA animate style,',
    prompt_suffix: 'educational bonhommes illustration, no color fills, no gradients, pure line drawing, maximum legibility, symbolic storytelling',
    image_size: 'landscape_16_9',
    num_inference_steps: 20,
  },
  minimaliste: {
    prompt_prefix: 'simple black line art, white background, minimalist stickman figures, stick figure illustration, ultra clean linework, no fills, no gradients,',
    prompt_suffix: 'educational diagram style, simple expressive stick characters, maximum legibility',
    image_size: 'landscape_16_9',
    num_inference_steps: 20,
  },
  // PDF canonical style — Illustration Plat
  'flat-design': {
    prompt_prefix: 'flat design illustration, bold solid colors, clean geometric shapes, modern vector art, no shadows, no gradients, Dribbble-quality design, SVG-like aesthetic,',
    prompt_suffix: 'professional flat illustration, vibrant color palette, clear visual storytelling, modern digital design, no photorealism',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  infographie: {
    prompt_prefix: 'modern flat infographic illustration, animated data visualization, bold color-coded sections, clean icons, isometric perspective, sans-serif labels,',
    prompt_suffix: 'information design, clear hierarchy, professional B2B report style, data-driven visual',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // PDF canonical style — 3D Pixar / Claymation
  '3d-pixar': {
    prompt_prefix: 'Pixar-style 3D CGI animation, claymation texture, adorable rounded characters, soft studio lighting, rich vibrant colors, depth of field, Disney Pixar movie quality,',
    prompt_suffix: '3D render, smooth surfaces, expressive facial features, cinematic composition, family-friendly warmth, photoreal CGI',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // Catégorie 3 — Design & Rythme
  'motion-graphics': {
    prompt_prefix: 'flat design motion graphics, geometric shapes, vibrant vector colors, bold animated typography elements, kinetic composition, tech brand aesthetic,',
    prompt_suffix: 'high-end advertising quality, clean vector art, dynamic diagonal lines, modern UI feel',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  'animation-2d': {
    prompt_prefix: 'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors, no photorealism, no 3D, traditional animation style,',
    prompt_suffix: 'studio quality animation frame, warm expressive characters, graphic novel aesthetic',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  // Motion Graphics styles
  corporate: {
    prompt_prefix: 'clean corporate business illustration, navy blue and white palette, professional office setting, minimal geometric shapes, modern UI elements,',
    prompt_suffix: 'B2B brand aesthetic, trustworthy, Fortune 500 style',
    image_size: 'landscape_16_9',
    num_inference_steps: 25,
  },
  dynamique: {
    prompt_prefix: 'high-energy dynamic composition, explosive motion blur, neon accent colors on dark background, diagonal lines, bold typography elements,',
    prompt_suffix: 'sports brand aesthetic, kinetic energy, powerful impact',
    image_size: 'landscape_16_9',
    num_inference_steps: 20,
  },
  luxe: {
    prompt_prefix: 'ultra-luxury brand photography, gold and black palette, bokeh background, premium product on marble surface, elegant serif typography overlay,',
    prompt_suffix: 'high-fashion editorial, Vogue aesthetic, exclusive premium feel',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  fun: {
    prompt_prefix: 'playful cartoon illustration, candy-colored palette, bubbly rounded shapes, confetti, stickers, kawaii-inspired characters,',
    prompt_suffix: 'joyful cheerful energy, kids-friendly, Instagram-ready pop art',
    image_size: 'landscape_16_9',
    num_inference_steps: 20,
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
  brand?: BrandColors,
  modelOverride?: string
): Promise<GenerateImageResult> {
  const styleConfig = STYLE_CONFIGS[style] ?? DEFAULT_STYLE
  const model = modelOverride ?? selectFalModelForF1Style(style)
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
        num_inference_steps: modelOverride ? 28 : styleConfig.num_inference_steps,
        num_images: 1,
      }

      if (ASPECT_RATIO_MODELS.has(model)) {
        input.aspect_ratio = IMAGE_SIZE_TO_ASPECT_RATIO[styleConfig.image_size] ?? '16:9'
      } else {
        input.image_size = styleConfig.image_size
      }

      // Seed fixe = character consistency entre scènes (PDF: cref pattern)
      if (seed !== undefined) {
        input.seed = seed
      }

      const result = await Promise.race([
        fal.run(model, { input } as any),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fal.ai timeout')), TIMEOUT_IMAGE_MS)
        ),
      ])

      const duration = Date.now() - startTime
      const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
      const imageUrl = output.images?.[0]?.url

      if (!imageUrl) throw new Error('No image URL in fal.ai response')

      logger.info(
        { model, style, duration, attempt, hasSeed: seed !== undefined },
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

  // Fallback final : flux/schnell (4 steps, ~3s) si flux/dev échoue toutes les tentatives
  logger.warn({ style, prompt: prompt.slice(0, 60) }, 'fal.ai: flux/dev failed — trying flux/schnell fallback')
  try {
    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      image_size: styleConfig.image_size,
      num_inference_steps: 4,
      num_images: 1,
    }
    if (seed !== undefined) input.seed = seed

    const result = await Promise.race([
      fal.run('fal-ai/flux/schnell', { input } as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('flux/schnell timeout')), TIMEOUT_IMAGE_MS)
      ),
    ])

    const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
    const imageUrl = output.images?.[0]?.url
    if (!imageUrl) throw new Error('No image URL in flux/schnell response')

    logger.info({ style }, 'fal.ai: flux/schnell fallback succeeded')
    return { imageUrl, promptUsed: fullPrompt }
  } catch (schnellErr) {
    logger.error({ error: lastError, schnellErr, style, prompt }, 'fal.ai: all attempts including schnell fallback failed')
    throw new Error(`Image generation failed: ${lastError?.message ?? 'Unknown error'}`)
  }
}

/**
 * Génère les images pour toutes les scènes en parallèle via text-to-image.
 * Cohérence visuelle assurée par le masterSeed déterministe (même seed = même atmosphère).
 */
export async function generateSceneImages(
  scenes: Array<{ id: string; description_visuelle: string }>,
  style: string,
  masterSeed?: number,
  brand?: BrandColors,
  persist?: { userId: string; videoId: string }
): Promise<Array<{ sceneId: string; imageUrl: string; promptUsed: string }>> {
  if (scenes.length === 0) return []

  const settled = await Promise.allSettled(
    scenes.map(async (scene, idx) => {
      const seed = masterSeed !== undefined ? masterSeed + idx : undefined
      const { imageUrl: falUrl, promptUsed } = await generateSceneImage(
        scene.description_visuelle,
        style,
        seed,
        brand
      )
      let imageUrl = falUrl
      if (persist) {
        const storagePath = `${persist.userId}/${persist.videoId}/scenes/scene-${scene.id}.jpg`
        imageUrl = await uploadFalUrlToStorage(falUrl, storagePath, 'videos')
      }
      return { sceneId: scene.id, imageUrl, promptUsed }
    })
  )

  const failed = settled.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    logger.warn({ failedCount: failed.length, total: scenes.length }, 'fal.ai: some scenes failed image generation')
  }

  // If ALL scenes failed, throw so the pipeline can surface the error
  if (failed.length === scenes.length) {
    const firstErr = (failed[0] as PromiseRejectedResult).reason
    throw new Error(`All scene image generation failed: ${firstErr?.message ?? String(firstErr)}`)
  }

  return settled
    .map((r, idx) =>
      r.status === 'fulfilled'
        ? r.value
        : { sceneId: scenes[idx].id, imageUrl: '', promptUsed: '' }
    )
    .filter((r) => r.imageUrl !== '')
}

/**
 * Génère une image en utilisant une image de référence pour la cohérence visuelle.
 * Utilise flux/dev/image-to-image.
 *
 * Convention fal.ai strength :
 *   0.0 → sortie = copie exacte de la référence (0% prompt)
 *   1.0 → sortie = génération libre par le prompt (100% prompt, ignore référence)
 *
 * Pour cohérence de style sans copier le contenu, utiliser 0.65–0.80.
 * Pour fortes contraintes visuelles (cref / personnage), utiliser 0.15–0.30.
 */
async function generateSceneImageWithReference(
  prompt: string,
  style: string,
  referenceImageUrl: string,
  seed?: number,
  brand?: BrandColors,
  strength = 0.15  // override par l'appelant selon le cas d'usage
): Promise<GenerateImageResult> {
  const styleConfig = STYLE_CONFIGS[style] ?? DEFAULT_STYLE
  const brandSuffix = brand
    ? `, color palette ${brand.primary_color}${brand.secondary_color ? ` and ${brand.secondary_color}` : ''}`
    : ''
  const fullPrompt = `${styleConfig.prompt_prefix} ${prompt}, ${styleConfig.prompt_suffix}${brandSuffix}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        image_url: referenceImageUrl,
        strength,
        image_size: styleConfig.image_size,
        num_inference_steps: styleConfig.num_inference_steps,
        num_images: 1,
      }
      if (seed !== undefined) input.seed = seed

      const result = await Promise.race([
        fal.subscribe('fal-ai/flux/dev/image-to-image', { input } as any),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fal.ai img2img timeout')), TIMEOUT_IMAGE_MS)
        ),
      ])

      const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
      const imageUrl = output.images?.[0]?.url
      if (!imageUrl) throw new Error('No image URL in img2img response')

      logger.info({ style, attempt, referenceUsed: true }, 'fal.ai: img2img scene generated')
      return { imageUrl, promptUsed: fullPrompt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, error: lastError.message }, 'fal.ai: img2img failed, retrying or falling back')
      if (attempt <= MAX_RETRIES) await sleep(1000 * attempt)
    }
  }

  // Fallback: génération pure sans référence
  logger.warn({ style }, 'fal.ai: img2img failed, falling back to text-to-image')
  return generateSceneImage(prompt, style, seed, brand)
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

// ── Image-to-Video ────────────────────────────────────────────────────────────

// Styles qui justifient Kling v1.5 Pro (90-120 s, qualité photoréaliste)
const HIGH_QUALITY_VIDEO_STYLES = new Set(['cinematique', 'stock-vo', 'luxe', '3d-pixar'])

/**
 * Kling v1 Standard — modèle rapide (~30-60 s).
 * Utilisé pour la majorité des styles (illustration, flat-design, motion, etc.)
 */
async function generateSceneVideoKlingStandard(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Kling v1 Standard')

  const result = await Promise.race([
    fal.subscribe('fal-ai/kling-video/v1/standard/image-to-video', {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration,
        cfg_scale: 0.5,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Kling Standard timeout')), TIMEOUT_VIDEO_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } }
  const videoUrl = output.video?.url
  if (!videoUrl) throw new Error('No video URL in Kling Standard response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Kling Standard complete')
  return { videoUrl }
}

/**
 * Kling v1.5 Pro — modèle premium (~90-120 s).
 * Réservé aux styles photoréalistes (cinematique, stock-vo, luxe, 3d-pixar).
 */
async function generateSceneVideoKlingPro(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Kling v1.5 Pro')

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
      setTimeout(() => reject(new Error('Kling Pro timeout')), TIMEOUT_VIDEO_MS * 2)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } }
  const videoUrl = output.video?.url
  if (!videoUrl) throw new Error('No video URL in Kling Pro response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Kling Pro complete')
  return { videoUrl }
}

/**
 * Anime une image statique en vidéo courte.
 * Route vers Kling v1 Standard (rapide) ou v1.5 Pro (qualité) selon le style.
 * Fallback automatique de Standard → Pro si le modèle rapide échoue.
 */
export async function generateSceneVideo(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  return generateSceneVideoKlingPro(imageUrl, animationPrompt, duration)
}

/**
 * Routeur vidéo style-aware :
 * - Styles illustration/flat → Kling v1 Standard (~30-60 s)
 * - Styles photoréalistes    → Kling v1.5 Pro (~90-120 s)
 * - Fallback Standard → Pro si le modèle rapide échoue
 */
export async function generateSceneVideoAuto(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5',
  style?: string
): Promise<{ videoUrl: string; model: string }> {
  const usePro = HIGH_QUALITY_VIDEO_STYLES.has(style ?? '')

  if (usePro) {
    const result = await generateSceneVideoKlingPro(imageUrl, animationPrompt, duration)
    return { ...result, model: 'kling-pro' }
  }

  // Standard d'abord (rapide) — fallback Pro si Standard échoue
  try {
    const result = await generateSceneVideoKlingStandard(imageUrl, animationPrompt, duration)
    return { ...result, model: 'kling-standard' }
  } catch (err) {
    logger.warn({ err, style }, 'Kling Standard failed — falling back to Pro')
    const result = await generateSceneVideoKlingPro(imageUrl, animationPrompt, duration)
    return { ...result, model: 'kling-pro-fallback' }
  }
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

// ── Supabase Storage upload ────────────────────────────────────────────────

/**
 * Télécharge une URL fal.ai CDN et uploade vers Supabase Storage.
 * Retourne l'URL publique permanente Supabase.
 * En cas d'échec d'upload, retourne l'URL fal.ai originale comme fallback.
 *
 * @param falUrl - URL CDN fal.ai (ex: https://fal.media/…)
 * @param storagePath - chemin dans le bucket (ex: brand-assets/logo-abc.jpg)
 * @param bucket - bucket Supabase (default: 'brand-assets')
 */
export async function uploadFalUrlToStorage(
  falUrl: string,
  storagePath: string,
  bucket = 'brand-assets',
  upsert = false
): Promise<string> {
  try {
    const res = await fetch(falUrl)
    if (!res.ok) throw new Error(`Failed to fetch fal.ai URL: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType, upsert })

    if (uploadError) {
      logger.warn({ uploadError, storagePath }, 'fal.ai: Supabase upload failed, using CDN URL')
      return falUrl
    }

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)
    logger.info({ storagePath, bucket }, 'fal.ai: asset uploaded to Supabase Storage')
    return data.publicUrl
  } catch (err) {
    logger.warn({ err, falUrl }, 'uploadFalUrlToStorage: error, returning original URL')
    return falUrl
  }
}
