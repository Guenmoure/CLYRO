import { createFalClient } from '@fal-ai/client'
import { getStyleLockSuffix } from '@clyro/shared'
import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'
import { selectFalModelForF1Style } from '../config/fal-models'

// Créer un client fal.ai typé avec la clé API
const fal = createFalClient({
  credentials: process.env.FAL_KEY,
})

const MAX_RETRIES = 1             // 1 retry avant fallback schnell (fail fast)

// Models that use aspect_ratio instead of image_size.
// Verified against @fal-ai/client typed input schemas:
//   - flux-pro/v1.x : aspect_ratio ✓
//   - ideogram v2/v3 : aspect_ratio ✓
//   - nano-banana-pro : aspect_ratio ✓
//   - flux-2-pro : image_size only (not aspect_ratio — stays out)
//   - recraft v3 + seedream v4 : image_size {width,height}
const ASPECT_RATIO_MODELS = new Set([
  // Legacy
  'fal-ai/flux-pro/v1.1-ultra',
  'fal-ai/flux-pro',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/ideogram/v2',
  // 2026 SOTA
  'fal-ai/nano-banana-pro',
  'fal-ai/nano-banana-2',
  'fal-ai/ideogram/v3',
])

const IMAGE_SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  'landscape_16_9': '16:9',
  'square_hd': '1:1',
  'portrait_16_9': '9:16',
}

// Explicit pixel dimensions for each preset. Using these instead of the
// fal.ai preset strings gives us two benefits:
//   1. All scenes come back at EXACTLY the same resolution, so ffmpeg
//      assembly never letterboxes one scene and crops another.
//   2. Dimensions are closer to the final 1920x1080 output — the default
//      landscape_16_9 preset was only 1024x576, forcing ~1.875x upscale
//      that made line-art (stickman) visibly soft.
// All values must be multiples of 16 (flux requirement).
const IMAGE_SIZE_TO_DIMS: Record<string, { width: number; height: number }> = {
  'landscape_16_9': { width: 1536, height: 864 },  // exact 16:9, ~1.5M pixels (flux sweet spot)
  'square_hd':      { width: 1024, height: 1024 },
  'portrait_16_9':  { width: 864,  height: 1536 },
}
const TIMEOUT_IMAGE_MS = 180_000  // flux/dev: 20-90s + queue wait; 3 min for parallel jobs
const TIMEOUT_VIDEO_MS = 150_000  // kling: up to 120s for Pro quality

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
  // Prompt kept short and positive-framed. Earlier version stacked four
  // negative constraints ("no color fills, no gradients, no photorealism")
  // which caused flux/dev to converge toward near-blank whitespace at 28
  // inference steps — the model was taking "no color" too literally.
  stickman: {
    prompt_prefix: 'hand-drawn black ink stick figure illustration on white paper, simple line drawing, minimalist cartoon style,',
    prompt_suffix: 'bold expressive strokes, clean linework, educational diagram style',
    image_size: 'landscape_16_9',
    num_inference_steps: 24,
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
  // Character Story — stylized digital characters, cel-shaded, dark bg
  'character-story': {
    prompt_prefix: 'digital character illustration, stylized semi-realistic cartoon, smooth cel-shaded rendering, warm rim lighting against dark background, subtle ambient glow, modern digital art style, Artstation quality,',
    prompt_suffix: 'vibrant but controlled color palette, cinematic composition, dark navy environment, floating holographic elements, 8K resolution',
    image_size: 'landscape_16_9',
    num_inference_steps: 28,
  },
  // Doodle — hand-drawn marker pen on clean white, Canva Doodlepedia look.
  // Prompt is positive-framed (no "no X" stacking) because Recraft V3 weights
  // explicit positive descriptors much more than negatives. The lock suffix +
  // anti-hallucination layer handle the no-text / no-photoreal negatives.
  doodle: {
    prompt_prefix: 'hand-drawn doodle illustration on clean white background, black ink outline sketch style, simple flat color fills, marker pen aesthetic, playful educational drawing, whiteboard explainer visual,',
    prompt_suffix: 'simple clean linework, sketch notebook aesthetic, minimal detail maximum clarity, flat spot colours of coral red, sky blue, sunny yellow, soft purple',
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
 * Génère une image pour une scène avec le style donné.
 *
 * Single-pass via fal-ai/flux/schnell at 1536×864 / 8 inference steps.
 * Previously a two-phase pipeline (schnell preview + flux/dev HD) — removed
 * because the 2× fal.ai requests saturated the 10-concurrent account cap at
 * 40+ scenes, and the preview→HD swap occasionally flashed blank frames.
 *
 * `modelOverride` is accepted for API-compat but ignored — everything goes
 * through schnell now. Seed optional for character consistency.
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
  // Model is now routed per style via F1_STYLE_MODEL_MAP (see fal-models.ts):
  //   - flux/schnell     → cinematique, stock-vo, 3d-pixar, luxe, fun, … (pure imagery)
  //   - flux-pro v1.1    → flat-design, minimaliste (typography-sensitive)
  //   - ideogram v2      → infographie, motion-graphics, whiteboard (text-heavy)
  // modelOverride still wins if an upstream caller insists.
  const model = modelOverride ?? selectFalModelForF1Style(style)
  // Brand color injection: append palette hint so fal.ai respects the brand palette
  const brandSuffix = brand
    ? `, color palette ${brand.primary_color}${brand.secondary_color ? ` and ${brand.secondary_color}` : ''}`
    : ''
  // Scene description LEADS — Flux weights the beginning of the prompt most heavily.
  // Style prefix + suffix are appended AFTER so the aesthetic decorates the scene
  // instead of overriding its composition.
  // The StyleLock consistency suffix locks the palette + temperature so all
  // scenes of the same video share one tonal identity (PR3). It tails the
  // prompt so it acts as a global colour grade rather than a content directive.
  const stylePrefix = styleConfig.prompt_prefix.replace(/,\s*$/, '')
  const styleSuffix = styleConfig.prompt_suffix.replace(/^\s*,/, '').trim()
  const lockSuffix  = getStyleLockSuffix(style)
  const fullPrompt  = `${prompt}, ${stylePrefix}, ${styleSuffix}${brandSuffix}, ${lockSuffix}`

  const useAspectRatio = ASPECT_RATIO_MODELS.has(model)
  const isIdeogram    = model.startsWith('fal-ai/ideogram/')
  const isIdeogramV3  = model === 'fal-ai/ideogram/v3'
  const isFluxPro     = model.startsWith('fal-ai/flux-pro/')
  const isFlux2Pro    = model === 'fal-ai/flux-2-pro'
  const isFluxSchnell = model === 'fal-ai/flux/schnell'
  const isNanoBanana  = model.startsWith('fal-ai/nano-banana')
  const isRecraft     = model.startsWith('fal-ai/recraft/')
  const isSeedream    = model.includes('/seedream/')

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const startTime = Date.now()

      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        num_images: 1,
      }

      if (useAspectRatio) {
        // Ideogram + flux-pro use aspect_ratio, not {width,height}.
        input.aspect_ratio = IMAGE_SIZE_TO_ASPECT_RATIO[styleConfig.image_size] ?? '16:9'
      } else {
        // Flux schnell/dev — explicit pixel dims keep every scene at identical resolution.
        input.image_size =
          IMAGE_SIZE_TO_DIMS[styleConfig.image_size] ?? { width: 1536, height: 864 }
      }

      if (isFluxSchnell) {
        // 8 is the max useful inference steps for flux/schnell — visibly
        // sharper than the default 4, still under ~5s per image.
        input.num_inference_steps = 8
      } else if (isFlux2Pro) {
        // FLUX.2 [pro] — newer than flux-pro v1.x. Same param surface:
        // fixed internal step count, expose safety_tolerance + output_format.
        input.safety_tolerance = '2'
        input.output_format   = 'jpeg'
      } else if (isFluxPro) {
        // Legacy flux-pro v1.x kept for backward compat.
        input.safety_tolerance = '2'
        input.output_format   = 'jpeg'
      } else if (isIdeogramV3) {
        // Ideogram V3 — same "design" style register as v2 but renamed
        // params: `rendering_speed` (TURBO/BALANCED/QUALITY) controls cost.
        // BALANCED gives the best quality/cost ratio for storyboard frames.
        input.rendering_speed = 'BALANCED'
        input.style           = 'DESIGN'
        input.expand_prompt   = false
      } else if (isIdeogram) {
        // Legacy Ideogram v2 fallback.
        input.style          = 'design'
        input.expand_prompt  = false
      } else if (isNanoBanana) {
        // Nano Banana (Google DM) — SynthID watermark is auto-applied,
        // commercial use is enabled via fal. No extra knobs needed at
        // this surface; quality is fixed Pro tier.
      } else if (isRecraft) {
        // Recraft V3 — `style` controls the brand register. The "doodle"
        // F1 style maps to the hand-drawn sub-style for sketch notebook
        // aesthetic; everything else uses the generic digital_illustration.
        // "vector_illustration" stays available for the logo helper.
        input.style = style === 'doodle'
          ? 'digital_illustration/hand_drawn'
          : 'digital_illustration'
      } else if (isSeedream) {
        // Seedream V4.5 — `image_size` accepts the same width/height object
        // as flux. No extra knobs at the value tier.
      }

      // Seed fixe = character consistency entre scènes (PDF: cref pattern)
      if (seed !== undefined) {
        input.seed = seed
      }

      const result = await Promise.race([
        fal.subscribe(model, { input } as any),
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

  logger.error({ error: lastError, style, prompt }, 'fal.ai: all schnell attempts failed')
  throw new Error(`Image generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

/**
 * Derive a per-scene seed from a master seed + scene index.
 * Adjacent seeds on Flux produce near-identical images; we spread them across
 * the full 32-bit seed space so each scene lives in a distinct region.
 * Same masterSeed still yields the same per-scene seeds → reproducible.
 */
function deriveSceneSeed(masterSeed: number, idx: number): number {
  // Large coprime multiplier + index XOR ensures big jumps in seed space.
  // Stay within the unsigned 31-bit range (most SDKs expect ≤ 2^31-1).
  const MULT = 2_654_435_761 // Knuth's multiplicative hash constant
  return ((masterSeed ^ (idx * MULT)) >>> 0) % 2_147_483_647
}

/**
 * Génère les images pour toutes les scènes en parallèle via text-to-image.
 * Cohérence visuelle assurée par le masterSeed déterministe (même masterSeed =
 * mêmes images). Les seeds par scène sont déterministes mais bien espacés pour
 * que chaque scène ait sa propre composition (seeds adjacents sur Flux donnent
 * des images quasi-identiques).
 */
export async function generateSceneImages(
  scenes: Array<{ id: string; description_visuelle: string }>,
  style: string,
  masterSeed?: number,
  brand?: BrandColors,
  persist?: { userId: string; videoId: string }
): Promise<Array<{ sceneId: string; imageUrl: string; promptUsed: string }>> {
  if (scenes.length === 0) return []

  // Concurrency limit: max 2 simultaneous fal.ai jobs to avoid queue timeouts.
  // fal.ai accepts all requests but queues them — too many parallel jobs means
  // later ones wait in queue and hit the TIMEOUT_IMAGE_MS before starting.
  const CONCURRENCY = 2

  const results: Array<PromiseSettledResult<{ sceneId: string; imageUrl: string; promptUsed: string }>> = []

  for (let i = 0; i < scenes.length; i += CONCURRENCY) {
    const batch = scenes.slice(i, i + CONCURRENCY)
    const batchSettled = await Promise.allSettled(
      batch.map(async (scene, batchIdx) => {
        const idx = i + batchIdx
        const seed = masterSeed !== undefined ? deriveSceneSeed(masterSeed, idx) : undefined
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
    results.push(...batchSettled)
  }

  const settled = results

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

// generateSceneImageWithReference (flux/dev img2img) retiré — flux/schnell ne
// supporte pas image-to-image. Les anciens appelants doivent utiliser
// generateSceneImage directement (cohérence via styleTokens dans le prompt).

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

  // Recraft V3 — purpose-built for brand/design work, beats flux/dev on
  // logo composition + colour palette adherence (2026 fal.ai SOTA pick).
  // Recraft generates 1 image per call by default — no num_images knob.
  const result = await Promise.race([
    fal.subscribe('fal-ai/recraft/v3/text-to-image', {
      input: {
        prompt: fullPrompt,
        image_size: { width: 1024, height: 1024 },
        style: 'vector_illustration',
      },
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

  // FLUX.2 [pro] — photorealism SOTA on fal.ai in 2026.
  // FLUX.2 [pro] uses the `image_size` preset string (square_hd /
  // portrait_16_9 / landscape_16_9 / etc.) — same vocabulary as the
  // legacy SOCIAL_FORMAT_MAP, so we can pass `imageSize` through directly.
  const result = await Promise.race([
    fal.subscribe('fal-ai/flux-2-pro', {
      input: {
        prompt: fullPrompt,
        image_size: imageSize as 'landscape_16_9' | 'square_hd' | 'portrait_16_9',
        safety_tolerance: '2',
        output_format: 'jpeg',
      },
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
 * Kling 3.0 Standard — base tier of the Kling v3 family (~30-60 s).
 * Replaces v2.5-turbo Standard. Same I/O surface (image_url + prompt +
 * duration + cfg_scale). 2026 SOTA standard-tier video model.
 *
 * NOTE: `fal-ai/kling-video/o3/standard/image-to-video` is documented
 * on fal.ai's catalog page (March 2026) but not yet in @fal-ai/client
 * typed endpoint map — we cast the options arg to bypass the lag.
 */
async function generateSceneVideoKlingStandard(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Kling v3 Standard')

  const result = await Promise.race([
    fal.subscribe('fal-ai/kling-video/o3/standard/image-to-video', {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration,
        cfg_scale: 0.5,
      },
    } as any),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Kling v3 Standard timeout')), TIMEOUT_VIDEO_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } }
  const videoUrl = output.video?.url
  if (!videoUrl) throw new Error('No video URL in Kling v3 Standard response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Kling v3 Standard complete')
  return { videoUrl }
}

/**
 * Kling 3.0 Pro — top-tier image-to-video (~60-180 s, ~$0.112/sec).
 * Motion-fluidity SOTA on fal.ai in 2026 (per fal's March 2026 ranking),
 * with native audio + voice ID support upstream. Replaces v2.5-turbo Pro
 * — quality bump on motion-heavy + cinematic shots is the rationale.
 * Reserved for premium-style content (cinematique, stock-vo, luxe, 3d-pixar)
 * and any prompt with a "complex" motion verb (orbit, crane, dolly, …).
 *
 * NOTE: `fal-ai/kling-video/v3/pro/image-to-video` is documented on
 * fal.ai's catalog page (March 2026) but not yet in @fal-ai/client
 * typed endpoint map — we cast to bypass the lag.
 */
async function generateSceneVideoKlingPro(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Kling v3 Pro')

  const result = await Promise.race([
    fal.subscribe('fal-ai/kling-video/v3/pro/image-to-video', {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration,
        cfg_scale: 0.5,
      },
    } as any),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Kling v3 Pro timeout')), TIMEOUT_VIDEO_MS * 2)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } }
  const videoUrl = output.video?.url
  if (!videoUrl) throw new Error('No video URL in Kling v3 Pro response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Kling v3 Pro complete')
  return { videoUrl }
}

/**
 * Anime une image statique en vidéo courte.
 * Alias de generateSceneVideoAuto() — utilise toujours le routeur style-aware.
 */
export async function generateSceneVideo(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5',
  style?: string
): Promise<{ videoUrl: string }> {
  const { videoUrl } = await generateSceneVideoAuto(imageUrl, animationPrompt, duration, style)
  return { videoUrl }
}

/**
 * Routeur vidéo style-aware :
 * - Styles photoréalistes (cinematique, stock-vo, luxe, 3d-pixar) → Kling v1.5 Pro
 * - Tous les autres styles → Kling v1 Standard (6× moins cher)
 * - PAS de fallback Standard→Pro : si Standard échoue, on laisse le pipeline
 *   utiliser l'image statique (assembleVideo fallback) plutôt que payer Pro.
 */
// ── PR3 — animation-complexity heuristic ───────────────────────────────
//
// "Complex" motion verbs are camera moves or transformations that
// benefit from the higher-quality Kling Pro model (orbit, crane,
// reveal, transform, dolly, parallax, …). Simple motions (fade, drift,
// gentle, subtle, slow zoom) are cheap to render well in Kling
// Standard.
//
// We ALSO use this as a "skip animation entirely" gate when the prompt
// is essentially static — that path returns null so the pipeline falls
// back to Ken Burns (free, smooth, no Kling cost).
const COMPLEX_MOTION_VERBS = new Set([
  'orbit', 'crane', 'reveal', 'transform', 'morph', 'parallax',
  'dolly', 'tracking', 'rotate', 'rotation', 'spin', 'zoom-out',
  'pull-back', 'pullback', 'push-in', 'push', 'fly-through', 'flyover',
  'unfold', 'explode', 'shatter', 'swirl', 'whirl', 'unzoom',
])

export type AnimationComplexity = 'static' | 'simple' | 'complex'

export function classifyAnimationComplexity(animationPrompt: string): AnimationComplexity {
  const normalized = (animationPrompt ?? '').toLowerCase()
  const tokens = normalized.split(/[\s,]+/).filter(Boolean)
  if (tokens.length <= 2) return 'static' // empty / 1-2 word prompts ⇒ Ken Burns
  let complexHits = 0
  for (const t of tokens) {
    if (COMPLEX_MOTION_VERBS.has(t)) complexHits++
  }
  if (complexHits >= 2) return 'complex'
  if (complexHits >= 1 && tokens.length >= 12) return 'complex'
  return 'simple'
}

export async function generateSceneVideoAuto(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5',
  style?: string
): Promise<{ videoUrl: string; model: string }> {
  const styleAllowsPro = HIGH_QUALITY_VIDEO_STYLES.has(style ?? '')
  const complexity = classifyAnimationComplexity(animationPrompt)

  // Pro route: premium-style content with at least a "simple" motion,
  // OR any style with a "complex" motion (the prompt itself justifies
  // the cost — orbits/transforms look cheap on Standard).
  const usePro = (styleAllowsPro && complexity !== 'static') || complexity === 'complex'

  if (usePro) {
    logger.info({ style, duration, complexity }, 'Kling router → v3 Pro')
    const result = await generateSceneVideoKlingPro(imageUrl, animationPrompt, duration)
    return { ...result, model: 'kling-v3-pro' }
  }

  // Standard uniquement — pas de fallback Pro (économie de crédits)
  logger.info({ style, duration, complexity }, 'Kling router → v3 Standard')
  const result = await generateSceneVideoKlingStandard(imageUrl, animationPrompt, duration)
  return { ...result, model: 'kling-v3-standard' }
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

/**
 * Hailuo 2.3 Standard — fast image-to-video (~30-60 s, 768p, 5-10 s clip).
 * MiniMax's standard tier — better motion + adherence than wan-i2v while
 * keeping the budget-friendly profile that justifies the 'fast' Animation
 * Mode. Replaces wan-i2v as of the 2026 SOTA curation.
 */
export async function generateSceneVideoHailuoStandard(
  imageUrl: string,
  animationPrompt: string,
  duration: '5' | '10' = '5'
): Promise<{ videoUrl: string }> {
  logger.info({ imageUrl: imageUrl.slice(0, 60), duration }, 'fal.ai: starting Hailuo 2.3 Standard')

  const result = await Promise.race([
    fal.subscribe('fal-ai/minimax/hailuo-2.3/standard/image-to-video', {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration,
      },
    } as any),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Hailuo 2.3 Standard timeout')), TIMEOUT_VIDEO_MS)
    ),
  ])

  const output = ((result as any).data ?? result) as { video?: { url: string } | string; video_url?: string }
  const videoUrl =
    (typeof output.video === 'string' ? output.video : output.video?.url) ??
    output.video_url

  if (!videoUrl) throw new Error('No video URL in Hailuo 2.3 Standard response')

  logger.info({ videoUrl: videoUrl.slice(0, 60) }, 'fal.ai: Hailuo 2.3 Standard complete')
  return { videoUrl }
}

/**
 * @deprecated Use `generateSceneVideoHailuoStandard` instead.
 * Back-compat alias retained while callers migrate off the wan-i2v name.
 * Will be removed once `pipeline/faceless.ts` is updated to call Hailuo
 * directly.
 */
export const generateSceneVideoWan = generateSceneVideoHailuoStandard

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

    const { data: signedData } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1-year signed URL
    if (signedData?.signedUrl) {
      logger.info({ storagePath, bucket }, 'fal.ai: asset uploaded to Supabase Storage')
      return signedData.signedUrl
    }
    // Fallback to public URL if signed URL creation fails
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)
    return data.publicUrl
  } catch (err) {
    logger.warn({ err, falUrl }, 'uploadFalUrlToStorage: error, returning original URL')
    return falUrl
  }
}
