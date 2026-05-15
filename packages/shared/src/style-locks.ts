/**
 * CLYRO — Style Locks.
 *
 * A "lock" is a high-level visual identity (palette + colour temperature
 * + finishing touches) that gets appended to EVERY image prompt of a
 * video. It's the missing layer between the per-style prefix/suffix
 * (which lives in apps/api/src/services/fal.ts STYLE_CONFIGS) and the
 * per-scene description_visuelle from Claude.
 *
 * Without a lock, two scenes in "cinematique" style can land one cool
 * blue, the other warm gold — visually inconsistent. The lock adds
 * a consistent palette spec so all scenes of the same video share
 * the same tonal identity.
 *
 * Each of the 14 visual styles in STYLE_VISUAL_GUIDE is mapped to ONE
 * of the 8 locks below — keep in sync with `LOCK_BY_STYLE_ID` at the
 * bottom of this file when adding new styles.
 */

export type StyleLockId =
  | 'cinematic-ai'    // warm gold + cool blue shadows, anamorphic, film grain
  | 'documentary'     // neutral, journalistic, sharp focus, no grading
  | 'dark-narrative'  // cold desaturated, deep shadows, noir tension
  | 'minimalist'      // soft warm pastels, negative space, zen
  | 'illustrated'     // warm watercolor, hand-drawn, editorial book
  | 'motion-design'   // cool tech blue on dark, geometric, glowing accents
  | '3d-render'       // bright neutral, soft ambient occlusion, Pixar
  | 'webcomic'        // vivid, comic art, bold outlines, manga-cel
  | 'character-story'  // dark bg, warm rim light, violet tech glow, cel-shaded

export interface StyleLock {
  id:               StyleLockId
  /** 3-colour palette as HEX strings — used in the consistency suffix
   *  to constrain Flux's colour choices across scenes. */
  palette:          [string, string, string]
  /** Plain English temperature descriptor (warm / cool / neutral / etc).
   *  Helps Claude pick lighting words consistent with the lock. */
  temperature:      string
  /** Suffix appended to every image prompt of a video that uses this
   *  lock. Should describe the COMMON visual identity (palette,
   *  finishing, camera feel) — NOT the per-scene content. */
  consistencySuffix: string
}

export const STYLE_LOCKS: Record<StyleLockId, StyleLock> = {
  'cinematic-ai': {
    id: 'cinematic-ai',
    palette: ['#0A1628', '#D4AF37', '#1E3A5F'],
    temperature: 'warm-cool contrast',
    consistencySuffix:
      'cinematic color grading, warm golden tones with cool blue shadows, '
      + 'film grain, anamorphic lens flare, deep contrast, dark vignette edges, '
      + 'shot on ARRI Alexa Mini, Cooke Anamorphic lens, 8K',
  },
  documentary: {
    id: 'documentary',
    palette: ['#2D3748', '#E2E8F0', '#4A5568'],
    temperature: 'neutral',
    consistencySuffix:
      'natural documentary lighting, neutral color balance, clean sharp focus, '
      + 'journalistic photography style, no color grading, realistic tones, '
      + 'shot on Sony FX6, 24-70mm zoom, 4K broadcast quality',
  },
  'dark-narrative': {
    id: 'dark-narrative',
    palette: ['#0A0A0A', '#1A0A0A', '#8B0000'],
    temperature: 'cold',
    consistencySuffix:
      'dark moody atmosphere, deep shadows with minimal fill, desaturated '
      + 'cold tones, noir cinematic, subtle fog, tension in every frame, '
      + 'shot on RED Komodo, vintage Zeiss lens, 8K, horror aesthetic',
  },
  minimalist: {
    id: 'minimalist',
    palette: ['#F8F9FB', '#E2E8F0', '#94A3B8'],
    temperature: 'soft warm',
    consistencySuffix:
      'soft minimal photography, clean background, natural diffused light, '
      + 'muted pastel tones, extreme negative space, zen aesthetic, one '
      + 'single subject, editorial simplicity, shot on Fujifilm GFX100, 80mm, 8K',
  },
  illustrated: {
    id: 'illustrated',
    palette: ['#FDF2F8', '#FBBF24', '#A78BFA'],
    temperature: 'warm',
    consistencySuffix:
      'warm hand-drawn illustration style, soft watercolor textures, '
      + 'friendly rounded shapes, cozy color palette, editorial book '
      + 'illustration, gentle shadows, digital painting with traditional feel',
  },
  'motion-design': {
    id: 'motion-design',
    palette: ['#0F172A', '#3B82F6', '#FFFFFF'],
    temperature: 'cool-neutral',
    consistencySuffix:
      'clean data visualization aesthetic, dark background with glowing '
      + 'accent elements, geometric precision, tech UI style, subtle grid '
      + 'lines, futuristic professional, 8K render',
  },
  '3d-render': {
    id: '3d-render',
    palette: ['#7C3AED', '#FBBF24', '#EC4899'],
    temperature: 'bright neutral',
    consistencySuffix:
      '3D rendered scene with soft ambient occlusion, toy-like charm, '
      + 'Pixar-quality global illumination, isometric perspective, colorful '
      + 'soft materials, studio lighting with rim light, 8K render',
  },
  webcomic: {
    id: 'webcomic',
    palette: ['#1E293B', '#EC4899', '#FBBF24'],
    temperature: 'vivid',
    consistencySuffix:
      'digital comic art style, clean bold outlines, manga-influenced '
      + 'expressions, flat color fills with cel shading, dramatic panel '
      + 'composition, webtoon aesthetic, high contrast',
  },
  'character-story': {
    id: 'character-story',
    palette: ['#1A1F2E', '#F5A623', '#7C5CFC'],
    temperature: 'warm-cool contrast',
    consistencySuffix:
      'digital character illustration, smooth cel-shaded rendering, '
      + 'dark navy background (#1A1F2E), warm golden rim lighting (#F5A623), '
      + 'violet tech accent glow (#7C5CFC), stylized semi-realistic cartoon, '
      + 'Artstation quality, cinematic single-subject composition, 8K',
  },
}

/**
 * Map each of the 14 named visual styles (see STYLE_VISUAL_GUIDE in
 * style-guides.ts) to ONE style lock. Keep in sync when adding styles.
 */
const LOCK_BY_STYLE_ID: Record<string, StyleLockId> = {
  // Faceless — Catégorie 1 : Narratif & Immersif
  'cinematique':      'cinematic-ai',
  'stock-vo':         'documentary',
  // Faceless — Catégorie 2 : Explicatif & Didactique
  'whiteboard':       'illustrated',
  'stickman':         'illustrated',
  'minimaliste':      'minimalist',
  'flat-design':      'motion-design',
  'infographie':      'motion-design',
  '3d-pixar':         '3d-render',
  'animation-2d':     'illustrated',
  'motion-graphics':  'motion-design',
  // Character story
  'character-story':  'character-story',
  // Motion styles
  'corporate':        'documentary',
  'dynamique':        'dark-narrative',
  'luxe':             'cinematic-ai',
  'fun':              'webcomic',
}

/**
 * Resolve the StyleLock for any of the 14 visual style IDs. Falls
 * back to 'documentary' (neutral, safe) when the style is unknown.
 */
export function getStyleLock(styleId: string): StyleLock {
  const lockId = LOCK_BY_STYLE_ID[styleId] ?? 'documentary'
  return STYLE_LOCKS[lockId]
}

/**
 * Convenience accessor for the consistency suffix only — what most
 * call sites in fal.ts actually need.
 */
export function getStyleLockSuffix(styleId: string): string {
  return getStyleLock(styleId).consistencySuffix
}

// ── Anti-hallucination layer (additive on top of the lock system) ──────
//
// Diffusion models (Flux / recraft / Ideogram) hallucinate text in two
// classes of failures we observe in production:
//   1. Claude forgets to add "no text" to a prompt → fal renders gibberish
//      currencies, fake bank balances, made-up signs.
//   2. Claude forgets to repeat the consistency suffix on every scene →
//      scene 3 lands in a different palette/temperature than scenes 1-2.
//
// `applyAntiHallucination` runs AFTER Claude returns. It quietly appends
// what's missing on each `description_visuelle` so a model "forgetting"
// a rule never reaches fal.ai. Cheap, idempotent, never duplicates a
// suffix that's already there.

/**
 * Universal negative keywords appended to every image prompt. Flux,
 * recraft-v3 and Ideogram all respond to these literal negatives — the
 * keyword repetition matters more than the exact wording. Don't
 * paraphrase without A/B testing fal.ai output.
 */
export const NO_TEXT_NEGATIVE =
  'no text, no writing, no letters, no numbers visible, no captions, no signs, no labels'

/**
 * Force the no-text suffix + the style's consistency lock onto a raw
 * Claude-produced image prompt. Called per scene by the storyboard
 * pipeline before the prompt is shipped to fal.ai.
 *
 * Idempotent: if Claude already included the suffix or the lock, this
 * is a no-op. Detection uses cheap substring tests on lowercased text —
 * we don't try to parse the prompt, just to spot the canonical phrases.
 */
export function applyAntiHallucination(rawPrompt: string, styleId: string): string {
  const stripped = rawPrompt.trim().replace(/[.,;\s]+$/u, '')
  const lower = stripped.toLowerCase()
  const additions: string[] = []
  if (!/no text/.test(lower)) {
    additions.push(NO_TEXT_NEGATIVE)
  }
  const suffix = getStyleLockSuffix(styleId)
  // The lock suffix is long; pick a rare keyword from each lock as a
  // cheap presence test (palette names + camera bodies are distinctive).
  const lockMarker = suffix.split(',')[0]?.trim().toLowerCase() ?? ''
  if (lockMarker && !lower.includes(lockMarker)) {
    additions.push(suffix)
  }
  return additions.length === 0 ? stripped : `${stripped}, ${additions.join(', ')}`
}
