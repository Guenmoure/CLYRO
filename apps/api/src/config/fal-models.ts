// ── fal.ai model selection matrix ─────────────────────────────────────────────
// Maps scene_type / style characteristics to optimal fal.ai models

export interface FalModelConfig {
  model: string | null
  num_inference_steps: number
  description: string
}

export const FAL_MODEL_MATRIX: Record<string, FalModelConfig> = {
  // scene_type → model mapping
  'product_showcase': {
    model: 'fal-ai/flux-pro/v1.1-ultra',
    num_inference_steps: 28,
    description: 'Ultra quality for product shots',
  },
  'image_full': {
    model: 'fal-ai/flux/dev',
    num_inference_steps: 28,
    description: 'High quality for cinematic scenes',
  },
  'split_text_image': {
    model: 'fal-ai/recraft-v3',
    num_inference_steps: 28,
    description: 'Illustration style for split layouts',
  },
  'text_hero': {
    model: null,
    num_inference_steps: 0,
    description: 'No image needed for text-only scenes',
  },
  'stats_counter': {
    model: null,
    num_inference_steps: 0,
    description: 'No image needed for stats scenes',
  },
  'cta_end': {
    model: null,
    num_inference_steps: 0,
    description: 'No image needed for CTA finale',
  },
  // style overrides
  'style_illustration': {
    model: 'fal-ai/recraft-v3',
    num_inference_steps: 28,
    description: 'Vector illustration style',
  },
  'style_text_on_img': {
    model: 'fal-ai/ideogram/v2',
    num_inference_steps: 28,
    description: 'Text-legible image generation',
  },
}

/**
 * Selects the optimal fal.ai model for a scene based on its type and style.
 * Used by F2 Motion pipeline (scene_type routing).
 */
export function selectFalModel(sceneType?: string, style?: string): FalModelConfig {
  if (sceneType && FAL_MODEL_MATRIX[sceneType]) return FAL_MODEL_MATRIX[sceneType]
  if (style === 'illustration') return FAL_MODEL_MATRIX['style_illustration']
  return { model: 'fal-ai/flux/dev', num_inference_steps: 28, description: 'Default quality model' }
}

// ── F1 style → model matrix ──────────────────────��─────────────────────────────
// Each visual style is mapped to the optimal fal.ai model for text-to-image generation.
// img2img (scene coherence reference) always uses flux/dev/image-to-image regardless of
// the style model — it is the only guaranteed i2i endpoint across all fal.ai plans.

const F1_STYLE_MODEL_MAP: Record<string, string> = {
  // All styles use flux/schnell — 10× cheaper than flux/dev, ~3s/image, sufficient for scene backgrounds
  cinematique:      'fal-ai/flux/schnell',
  luxe:             'fal-ai/flux/schnell',
  '3d-pixar':       'fal-ai/flux/schnell',
  'animation-2d':   'fal-ai/flux/schnell',
  'flat-design':    'fal-ai/flux/schnell',
  'motion-graphics':'fal-ai/flux/schnell',
  corporate:        'fal-ai/flux/schnell',
  infographie:      'fal-ai/flux/schnell',
  whiteboard:       'fal-ai/flux/schnell',
  stickman:         'fal-ai/flux/schnell',
  minimaliste:      'fal-ai/flux/schnell',
  'stock-vo':       'fal-ai/flux/schnell',
  dynamique:        'fal-ai/flux/schnell',
  fun:              'fal-ai/flux/schnell',
}

/**
 * Returns the optimal fal.ai model for a given F1 visual style.
 * Falls back to flux/dev for unknown styles.
 */
export function selectFalModelForF1Style(style: string): string {
  return F1_STYLE_MODEL_MAP[style] ?? 'fal-ai/flux/dev'
}

/**
 * Returns true if the scene requires an image to be generated via fal.ai.
 */
export function sceneNeedsImage(sceneType?: string, needsBackground?: boolean): boolean {
  if (needsBackground === false) return false
  if (!sceneType) return true
  const config = FAL_MODEL_MATRIX[sceneType]
  return config ? config.model !== null : true
}
