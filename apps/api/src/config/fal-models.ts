// ── fal.ai model selection matrix ─────────────────────────────────────────────
// Maps scene_type / style characteristics to optimal fal.ai models
//
// 2026 SOTA curation — replaces the FLUX 1.x + Ideogram v2 baseline with
// model picks from fal.ai's March 2026 catalogue ranking:
//   - FLUX.2 [pro]            → photorealism SOTA
//   - Nano Banana Pro         → Google DeepMind general SOTA, character coherence
//   - Recraft V3              → designer-grade brand compositions
//   - Ideogram V3             → typography + photorealism
//   - Seedream V4.5           → value tier (replaces flux/schnell for cheap iteration)
//
// Each style maps to a model + an "image params" callback so we can pass
// model-specific knobs (aspect_ratio vs image_size, quality tiers, etc.)
// without polluting the generic caller.

export interface FalModelConfig {
  model: string | null
  num_inference_steps: number
  description: string
}

export const FAL_MODEL_MATRIX: Record<string, FalModelConfig> = {
  // scene_type → model mapping
  'product_showcase': {
    model: 'fal-ai/flux-2-pro',
    num_inference_steps: 28,
    description: 'FLUX.2 [pro] — photorealism SOTA for product shots',
  },
  'image_full': {
    model: 'fal-ai/flux-2-pro',
    num_inference_steps: 28,
    description: 'FLUX.2 [pro] — cinematic photoreal',
  },
  'split_text_image': {
    model: 'fal-ai/recraft/v3/text-to-image',
    num_inference_steps: 28,
    description: 'Recraft V3 — designer-grade compositional illustrations',
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
    model: 'fal-ai/recraft/v3/text-to-image',
    num_inference_steps: 28,
    description: 'Recraft V3 — vector / brand illustration',
  },
  'style_text_on_img': {
    model: 'fal-ai/ideogram/v3',
    num_inference_steps: 28,
    description: 'Ideogram V3 — text-legible image generation',
  },
}

/**
 * Selects the optimal fal.ai model for a scene based on its type and style.
 * Used by F2 Motion pipeline (scene_type routing).
 */
export function selectFalModel(sceneType?: string, style?: string): FalModelConfig {
  if (sceneType && FAL_MODEL_MATRIX[sceneType]) return FAL_MODEL_MATRIX[sceneType]
  if (style === 'illustration') return FAL_MODEL_MATRIX['style_illustration']
  return { model: 'fal-ai/flux-2-pro', num_inference_steps: 28, description: 'Default — FLUX.2 [pro]' }
}

// ── F1 style → model matrix ──────────────────────��─────────────────────────────
// Each visual style is mapped to the optimal fal.ai model for text-to-image generation.
// img2img (scene coherence reference) always uses flux/dev/image-to-image regardless of
// the style model — it is the only guaranteed i2i endpoint across all fal.ai plans.

// Text-heavy styles route to Ideogram V3 — best-in-class typography rendering
// in the consumer image-gen space (2026). Replaces Ideogram v2 from the
// previous map. ~$0.03-$0.09/image depending on quality tier.
const TEXT_HEAVY_STYLES: ReadonlySet<string> = new Set([
  'infographie',
  'motion-graphics',
  'whiteboard',
])

// Designer/brand-system styles → Recraft V3, the model built with designers
// for production brand work. Replaces FLUX-pro v1.1 from the previous map.
const TYPOGRAPHY_STYLES: ReadonlySet<string> = new Set([
  'flat-design',
  'minimaliste',
])

const F1_STYLE_MODEL_MAP: Record<string, string> = {
  // Photoreal cinematic styles → FLUX.2 [pro] (photorealism SOTA 2026).
  // Replaces flux/schnell — cost goes up ~3× but the quality jump on
  // photoreal styles is the whole point of "qualité maximale" curation.
  cinematique:      'fal-ai/flux-2-pro',
  'stock-vo':       'fal-ai/flux-2-pro',
  luxe:             'fal-ai/flux-2-pro',

  // Value tier — Seedream V4 (Bytedance). Cheaper than flux/schnell with
  // better baseline quality on stylised content. Picks up the
  // iteration-heavy styles where cost-per-image still matters.
  // V4.5 exists on fal.ai but isn't yet in the @fal-ai/client typed map,
  // so we stay on V4 until that lands (quality delta is small).
  '3d-pixar':       'fal-ai/bytedance/seedream/v4/text-to-image',
  'animation-2d':   'fal-ai/bytedance/seedream/v4/text-to-image',
  corporate:        'fal-ai/bytedance/seedream/v4/text-to-image',
  stickman:         'fal-ai/bytedance/seedream/v4/text-to-image',
  dynamique:        'fal-ai/bytedance/seedream/v4/text-to-image',
  fun:              'fal-ai/bytedance/seedream/v4/text-to-image',

  // Character coherence → Nano Banana Pro (Google DeepMind). Best
  // general-purpose model in 2026 + strong subject consistency across
  // scenes, critical for the "same character across N shots" requirement.
  'character-story':'fal-ai/nano-banana-pro',

  // Designer/brand compositional → Recraft V3 (designer-grade)
  'flat-design':    'fal-ai/recraft/v3/text-to-image',
  minimaliste:      'fal-ai/recraft/v3/text-to-image',

  // Doodle (hand-drawn explainer) → Recraft V3 with the
  // `digital_illustration/hand_drawn` sub-style (configured per-call
  // in services/fal.ts). Recraft is the only model in the curated set
  // with a dedicated sketch sub-style enum value.
  'doodle':         'fal-ai/recraft/v3/text-to-image',

  // Text-heavy → Ideogram V3 (best legible-typography model in 2026)
  infographie:      'fal-ai/ideogram/v3',
  'motion-graphics':'fal-ai/ideogram/v3',
  whiteboard:       'fal-ai/ideogram/v3',
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
 * Falls back to FLUX.2 [pro] for unknown styles (safer default in 2026
 * than the legacy flux/dev).
 */
export function selectFalModelForF1Style(style: string): string {
  return F1_STYLE_MODEL_MAP[style] ?? 'fal-ai/flux-2-pro'
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
