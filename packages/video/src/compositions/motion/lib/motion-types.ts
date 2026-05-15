// ── F2 Motion Design — type system ─────────────────────────────────────────
// All scene props are discriminated unions keyed by `type` so the
// MotionComposition router can switch exhaustively without casting.

export type MotionSceneType =
  | '3d_cards'
  | 'hero_typo'
  | 'avatar_grid'
  | 'dark_light_switch'
  | 'floating_icons'
  | 'mockup_zoom'
  | 'stats_counter'
  | 'logo_reveal'

// ── Per-scene prop shapes ────────────────────────────────────────────────────

export interface Scene3DCardsProps {
  type: '3d_cards'
  cards: {
    avatar?:   string   // image URL
    name:      string
    content:   string
    metrics?:  { likes?: number; comments?: number }
    platform?: 'instagram' | 'linkedin' | 'tiktok' | 'twitter'
  }[]
  headline: string
  mode:     'dark' | 'light'
  layout?:  'scatter' | 'v_shape' | 'tunnel' | 'orbit'
}

export interface SceneHeroTypoProps {
  type:       'hero_typo'
  text:       string
  subtext?:   string
  mode:       'dark' | 'light'
  animation:  'word_by_word' | 'line_by_line' | 'scale_bounce' | 'split_reveal' | '3d_rotate'
  color:      string   // hex — e.g. '#E8593C'
  fontSize?:  number   // px, default 120
}

export interface SceneAvatarGridProps {
  type: 'avatar_grid'
  avatars: { url: string; name: string }[]
  headline:   string
  mode:       'dark' | 'light'
  zoomIndex?: number
}

export interface SceneDarkLightProps {
  type:      'dark_light_switch'
  direction: 'dark_to_light' | 'light_to_dark'
  style?:    'flash' | 'wipe' | 'circle_reveal'
}

export interface SceneFloatingIconsProps {
  type: 'floating_icons'
  icons: {
    emoji: string
    label: string
    color: string
  }[]
  headline:      string
  notification?: { avatar: string; text: string }
  mode:          'dark' | 'light'
}

export interface SceneMockupZoomProps {
  type:           'mockup_zoom'
  screenshotUrl:  string
  focusArea:      { x: number; y: number; w: number; h: number }
  annotation:     string
  cursorPath:     { x: number; y: number; frame: number; click?: boolean }[]
  mode:           'dark' | 'light'
}

export interface SceneStatsCounterProps {
  type: 'stats_counter'
  stats: {
    value:  number
    unit:   string    // '$', '%', 'k', 'M', 'x', etc.
    label:  string
    color:  string
  }[]
  headline?: string
  mode:      'dark' | 'light'
}

export interface SceneLogoRevealProps {
  type:        'logo_reveal'
  logoUrl:     string
  tagline?:    string
  brandColor:  string
  style?:      'assemble' | 'scale_bounce' | 'particles_in'
  mode:        'dark' | 'light'
}

export type MotionSceneProps =
  | Scene3DCardsProps
  | SceneHeroTypoProps
  | SceneAvatarGridProps
  | SceneDarkLightProps
  | SceneFloatingIconsProps
  | SceneMockupZoomProps
  | SceneStatsCounterProps
  | SceneLogoRevealProps

// ── Composition-level types ──────────────────────────────────────────────────

export interface MotionScene {
  id:       string
  type:     MotionSceneType
  /**
   * Duration in frames at 30 fps. The backend OVERRIDES Claude's hint
   * with the actual ElevenLabs audio length (per scene) so visuals and
   * voiceover stay perfectly synced. Scenes without voiceover keep
   * Claude's hint.
   */
  duration: number
  props:    MotionSceneProps
  /**
   * Per-scene voiceover audio as a `data:audio/mpeg;base64,...` URL.
   * Mounted as `<Audio>` INSIDE the scene's `<Sequence>` so each clip
   * starts exactly when the scene appears on screen. When omitted the
   * scene plays without voiceover (dark_light_switch transitions, pure
   * visual beats). Replaces the legacy single-track `audioUrl` field.
   */
  voiceoverAudioUrl?: string
}

export interface MotionCompositionProps {
  scenes:    MotionScene[]
  musicUrl?: string
  /**
   * Deprecated. Kept for backwards compat with any caller still passing
   * a concatenated voiceover track. Prefer per-scene `voiceoverAudioUrl`
   * on each MotionScene — see the pipeline rewrite for the rationale.
   */
  audioUrl?: string
  format:    '16_9' | '9_16' | '1_1'
  /**
   * Brand theme applied to every scene via the React context. When
   * omitted scenes use the default CLYRO palette. Pipeline wires this
   * from `brandConfig.{primary_color, secondary_color, font_family}`.
   */
  brand?: {
    primary?:    string
    secondary?:  string
    fontFamily?: string
  }
}

// ── Output dimensions per format ─────────────────────────────────────────────

export const MOTION_DIMENSIONS = {
  '16_9': { width: 1920, height: 1080 },
  '9_16': { width: 1080, height: 1920 },
  '1_1':  { width: 1080, height: 1080 },
} as const
