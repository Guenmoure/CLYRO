export type VideoModule = 'faceless' | 'motion'

// ── Animation Mode ─────────────────────────────────────────────────────────────

export type AnimationMode = 'storyboard' | 'fast' | 'pro'

export interface AnimationModeConfig {
  mode:           AnimationMode
  label:          string
  description:    string
  clipDuration:   number   // 0 = Ken Burns, 5 = fast, 8 = pro
  model:          string | null
  creditsPerMin:  number
  generationTime: string
  availablePlans: ('free' | 'starter' | 'pro' | 'creator' | 'studio')[]
}

export const ANIMATION_MODES: Record<AnimationMode, AnimationModeConfig> = {
  storyboard: {
    mode:           'storyboard',
    label:          'Storyboard',
    description:    'Images fixes avec Ken Burns. Rapide, économique, idéal pour tester.',
    clipDuration:   0,
    model:          null,
    creditsPerMin:  5,
    generationTime: '~2 min',
    availablePlans: ['free', 'starter', 'pro', 'creator', 'studio'],
  },
  fast: {
    mode:           'fast',
    label:          'Fast Animation',
    description:    'Clips Hailuo 2.3 Standard 5–10 s. Meilleur rapport qualité/crédits.',
    clipDuration:   5,
    // Hailuo 2.3 Standard — MiniMax 768p tier, replaces wan-i2v.
    model:          'fal-ai/minimax/hailuo-2.3/standard/image-to-video',
    creditsPerMin:  30,    // slight bump from 25 — Hailuo ~$0.07/sec vs wan ~$0.05/sec
    generationTime: '~5 min',
    availablePlans: ['pro', 'creator', 'studio'],
  },
  pro: {
    mode:           'pro',
    label:          'Pro Animation',
    description:    'Clips Kling v3 Pro 8 s. Motion-fluidity SOTA, qualité photoréaliste max.',
    clipDuration:   8,
    // Kling 3.0 Pro — motion-fluidity SOTA on fal.ai (March 2026 ranking).
    // Replaces Kling v1.5 / v2.5-turbo Pro.
    model:          'fal-ai/kling-video/v3/pro/image-to-video',
    creditsPerMin:  130,   // bump from 80 — Kling v3 Pro is ~$0.112/sec vs v2.5-turbo ~$0.07/sec (+60%)
    generationTime: '~15 min',
    availablePlans: ['pro', 'creator', 'studio'],
  },
}

/** Résout le mode effectif d'une scène (global + override par index). */
export function resolveSceneMode(
  globalMode: AnimationMode,
  sceneIndex: number,
  overrides:  Record<number, AnimationMode>
): AnimationMode {
  return overrides[sceneIndex] ?? globalMode
}
/**
 * Canonical 4-value status enum. New writes only use these four.
 * Legacy values ('pending', 'processing', 'storyboard', 'visuals',
 * 'audio', 'assembly', 'animation', 'completed') are still recognised
 * by readers for backwards-compat with rows created before the enum
 * was tightened — see apps/web/components/shared/video-card.tsx for
 * the mapping table.
 */
export type VideoStatus =
  | 'draft'
  | 'generating'
  | 'done'
  | 'error'
  // Legacy in-progress phases — still in production rows pending migration.
  | 'pending'
  | 'processing'
  | 'storyboard'
  | 'visuals'
  | 'audio'
  | 'animation'
  | 'assembly'
  | 'completed'

export type FacelessStyle =
  | 'cinematique'
  | 'stock-vo'
  // PDF canonical 4 styles
  | 'whiteboard'
  | 'stickman'
  | 'flat-design'
  | '3d-pixar'
  // Legacy / extended styles
  | 'minimaliste'
  | 'infographie'
  | 'motion-graphics'
  | 'animation-2d'
  | 'character-story'
  // Doodle — hand-drawn explainer style, marker pen aesthetic on white
  | 'doodle'

export type MotionStyle = 'corporate' | 'dynamique' | 'luxe' | 'fun'
export type VideoFormat = '9:16' | '1:1' | '16:9'
export type VideoDuration = '6s' | '15s' | '30s' | '60s' | '120s' | '180s' | '300s' | 'auto'

export type AnimationType = 'slide-in' | 'zoom' | 'fade' | 'particle-burst' | 'typewriter'
export type SceneType = 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'

// Programmatic text overlay burned onto the scene's background image.
// Used for stats, titles, key phrases, comparisons, list items, sources,
// and CTAs — anything that must render pixel-perfect and that diffusion
// models (Flux, Ideogram) cannot reliably draw.
//
// Aligned with the 6+1 spec types from CLYRO_TEXT_AND_PROMPTS:
//   stat | headline | key_phrase | comparison | list_item | source | cta
//   plus the legacy aliases title (= headline) and quote (= key_phrase)
//   so existing prompts/data keep working.
export type SceneOverlayType =
  | 'stat'
  | 'headline'
  | 'title'        // alias of headline (back-compat)
  | 'key_phrase'
  | 'quote'        // alias of key_phrase (back-compat)
  | 'comparison'
  | 'list_item'
  | 'source'
  | 'cta'
export type SceneOverlayPosition =
  | 'top-center'    | 'top-left'    | 'top-right'
  | 'center'
  | 'bottom-center' | 'bottom-left' | 'bottom-right'

export interface SceneOverlay {
  type: SceneOverlayType
  text: string                          // "87%", "1M€ en 30 jours", "Think different"
  position?: SceneOverlayPosition       // default: depends on type (see buildOverlayFilter)
  /** Word from the scene's narration (texte_voix) that triggers the overlay's
   *  appearance. The pipeline maps this to a startFrame using ElevenLabs
   *  word-level timestamps. Optional — when absent, the overlay falls back
   *  to "show for the entire scene" (legacy behaviour, ignored by the
   *  scheduler in PR2). */
  trigger_word?: string
  /** How long the overlay stays visible after triggering, in seconds.
   *  Defaults to 3s in the pipeline. */
  duration_seconds?: number
}

/**
 * Faceless scene subtype — drives the per-scene image-prompt template.
 * Distinct from Motion Design's `scene_type` (which routes Remotion
 * components). Claude classifies each faceless scene into one of:
 *   - broll       — atmospheric stock-style footage, rich detail, no
 *                   negative space needed (text lives in karaoke bottom)
 *   - infographic — chart / data viz / silhouette with negative space
 *                   in the center for a stat overlay
 *   - typography  — minimal background, the text overlay IS the content
 *                   (full-frame negative space)
 *   - demo        — interface / app screen / product mockup with focused
 *                   subject and clean composition
 *
 * Defaults to 'broll' in the pipeline when omitted (safest fallback —
 * a rich atmospheric image works for any narration).
 */
export type FacelessSceneType = 'broll' | 'infographic' | 'typography' | 'demo'

export interface Scene {
  id: string
  index: number
  description_visuelle: string
  animation_prompt?: string
  texte_voix: string
  duree_estimee: number
  image_url?: string
  // Multi-character dialogue support
  speaker?: string                // nom du personnage parlant (ex: "Alice", "Bob")
  voice_id?: string               // voice_id ElevenLabs pour ce personnage (si dialogue_mode actif)
  // Programmatic overlay — chiffres, titres, quotes rendus via drawtext en post
  overlay?: SceneOverlay
  // Faceless scene subtype — drives the per-scene image-prompt template (PR4).
  faceless_scene_type?: FacelessSceneType
  // Motion Design fields (optionnel — ignoré par le pipeline Faceless)
  display_text?: string           // texte affiché à l'écran (peut différer de la narration)
  animation_type?: AnimationType  // type d'animation Remotion pour cette scène
  scene_type?: SceneType          // type de composant Remotion (router DynamicComposition)
  needs_background?: boolean      // false = scène texte pur, pas de fal.ai
  cta_text?: string               // texte CTA pour la dernière scène
}

export interface VideoMetadata {
  scenes?: Scene[]
  voice_id?: string
  style?: string
  format?: VideoFormat
  duration?: VideoDuration
  brand_config?: BrandConfig
  progress?: number
  error_message?: string
}

export interface BrandConfig {
  logo_url?: string
  primary_color: string
  secondary_color?: string
  font_family?: string
  style: MotionStyle
}

// Identité visuelle persistante (Brand Kit)
export interface BrandKit {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string | null
  font_family: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateBrandKitPayload {
  name: string
  primary_color: string
  secondary_color?: string
  font_family?: string
  logo_url?: string
  is_default?: boolean
}

export interface UpdateBrandKitPayload extends Partial<CreateBrandKitPayload> {
  id: string
}

export interface Video {
  id: string
  user_id: string
  module: VideoModule
  style: string
  title: string
  status: VideoStatus
  output_url: string | null
  metadata: VideoMetadata
  created_at: string
}

export interface PreGeneratedScene {
  id: string
  script_text?: string
  image_url?: string
  clip_url?: string
  image_prompt?: string
  animation_prompt?: string
  /** Optional on-screen caption burned over the clip via ffmpeg drawtext. */
  overlay_text?: string
}

export interface CreateFacelessVideoPayload {
  title: string
  style: FacelessStyle
  input_type: 'script' | 'audio'
  format?: VideoFormat
  duration?: VideoDuration
  script?: string
  audio_url?: string
  voice_id?: string
  brand_kit_id?: string
  pre_generated_scenes?: PreGeneratedScene[]
  dialogue_mode?: boolean                // true = auto-detect & enable multi-character voices
  speaker_voices?: Record<string, string> // map speaker name → voice_id (optional override)
  animation_mode?: AnimationMode         // global animation mode (default: storyboard)
  animation_overrides?: Record<number, AnimationMode> // per-scene overrides
  // F1-012: optional background music preset (mixed at low gain on the timeline)
  music_preset?: 'none' | 'soft' | 'upbeat' | 'cinematic' | 'corporate'
  // F1-013: burn-in subtitles (word-level via TTS timestamps)
  subtitles_enabled?: boolean
  /**
   * Existing wizard draft id. When present, the backend promotes the
   * draft row in place instead of inserting a fresh sibling row. See
   * apps/web/hooks/use-draft-save.ts for the full rationale.
   */
  draft_id?: string
}

export interface MotionScene {
  index: number
  texte_voix: string
  duree_estimee: number
  // Legacy UI fields (motion-studio.tsx SceneCard/ScenePreview)
  text: string
  subtext: string
  highlight: string
  icon: string
  style: 'hero' | 'feature' | 'stats' | 'outro' | 'text-focus'
  accent_color: string
  stats?: Array<{ value: string; label: string }>
  // New pipeline fields (BrandScene / DynamicComposition)
  id?: string
  display_text?: string
  scene_type?: 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'
  animation_type?: 'slide-in' | 'zoom' | 'fade' | 'particle-burst' | 'typewriter'
  needs_background?: boolean
  cta_text?: string | null
  description_visuelle?: string
  image_url?: string
}

export interface CreateMotionVideoPayload {
  title: string
  brief: string
  /** Voiceover script. When provided + duration='auto', the scene count is
   *  derived from the word count so the full script is narrated, never
   *  condensed. Falls back to brief if omitted. */
  script?: string
  format: VideoFormat
  duration: VideoDuration
  style: MotionStyle
  brand_config: BrandConfig
  voice_id?: string
  music_track_id?: string
  /** See CreateFacelessVideoPayload.draft_id. */
  draft_id?: string
}
