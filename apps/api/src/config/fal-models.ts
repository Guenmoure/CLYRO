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

// Text-heavy styles route to Ideogram v2 — the only consumer image model
// that renders legible words, numbers, and chart labels reliably. ~2× the
// cost of schnell but required when the visual must include readable text.
const TEXT_HEAVY_STYLES: ReadonlySet<string> = new Set([
  'infographie',
  'motion-graphics',
  'whiteboard',
])

// Typography-sensitive styles where schnell produces soft/blurry type even
// without explicit text — flux-pro v1.1 gives noticeably cleaner vector look.
const TYPOGRAPHY_STYLES: ReadonlySet<string> = new Set([
  'flat-design',
  'minimaliste',
])

const F1_STYLE_MODEL_MAP: Record<string, string> = {
  // Pure image / background styles — schnell is fine, 10× cheaper, ~3s/image
  cinematique:      'fal-ai/flux/schnell',
  luxe:             'fal-ai/flux/schnell',
  '3d-pixar':       'fal-ai/flux/schnell',
  'animation-2d':   'fal-ai/flux/schnell',
  corporate:        'fal-ai/flux/schnell',
  stickman:         'fal-ai/flux/schnell',
  'stock-vo':       'fal-ai/flux/schnell',
  dynamique:        'fal-ai/flux/schnell',
  fun:              'fal-ai/flux/schnell',

  // Typography-sensitive → flux-pro v1.1 for cleaner vector edges
  'flat-design':    'fal-ai/flux-pro/v1.1',
  minimaliste:      'fal-ai/flux-pro/v1.1',

  // Text-heavy → Ideogram v2 (the only model that renders legible labels)
  infographie:      'fal-ai/ideogram/v2',
  'motion-graphics':'fal-ai/ideogram/v2',
  whiteboard:       'fal-ai/ideogram/v2',
}

/**
 * True if the style requires readable text/labels/numbers in the frame.
 * Callers can use this to (a) keep text in Claude's image prompt, and
 * (b) know that an Ideogram-class model is being used downstream.
 */
export function styleNeedsLegibleText(style: string): boolean {
  return TEXT_HEAVY_STYLES.has(style)
}

/**
 * True if the style benefits from better typography rendering than schnell
 * (flat-design, minimaliste) but doesn't need full text legibility.
 */
export function styleIsTypographySensitive(style: string): boolean {
  return TYPOGRAPHY_STYLES.has(style)
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
