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
  duration: number   // frames at 30 fps
  props:    MotionSceneProps
}

export interface MotionCompositionProps {
  scenes:    MotionScene[]
  musicUrl?: string
  audioUrl?: string  // voiceover data-URL
  format:    '16_9' | '9_16' | '1_1'
}

// ── Output dimensions per format ─────────────────────────────────────────────

export const MOTION_DIMENSIONS = {
  '16_9': { width: 1920, height: 1080 },
  '9_16': { width: 1080, height: 1920 },
  '1_1':  { width: 1080, height: 1080 },
} as const
