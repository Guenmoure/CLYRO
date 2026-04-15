/**
 * F5 Studio — shared types used by both the web frontend and
 * the Express backend. Mirrors supabase/migrations/20260415000002.
 */

export type StudioInputType = 'script' | 'youtube_url'

export type StudioFormat = '16_9' | '9_16' | 'both'

export type StudioProjectStatus =
  | 'draft'
  | 'analyzing'
  | 'generating'
  | 'editing'
  | 'rendering'
  | 'done'
  | 'error'

export type StudioSceneType =
  | 'avatar'
  | 'split'
  | 'infographic'
  | 'demo'
  | 'typography'
  | 'broll'

export type StudioSceneStatus =
  | 'pending'
  | 'generating'
  | 'done'
  | 'error'
  | 'regenerating'
  | 'outdated'

export type InfographicChartType =
  | 'bar' | 'pie' | 'line' | 'counter' | 'comparison' | 'steps'

export interface StudioProject {
  id: string
  user_id: string
  title: string
  input_type: StudioInputType
  input_value: string
  input_language: string
  original_script: string | null
  improved_script: string | null
  avatar_id: string | null
  voice_id: string | null
  format: StudioFormat
  background_color: string | null
  music_track: string | null
  status: StudioProjectStatus
  final_video_url: string | null
  final_video_9_16_url: string | null
  total_duration: number | null
  created_at: string
  updated_at: string
}

export interface StudioScene {
  id: string
  project_id: string
  user_id: string
  index: number
  type: StudioSceneType
  script: string
  duration_est: number | null
  duration_actual: number | null
  status: StudioSceneStatus
  video_url: string | null
  audio_url: string | null
  thumbnail_url: string | null
  heygen_video_id: string | null
  remotion_params: Record<string, unknown> | null
  broll_query: string | null
  pexels_video_url: string | null
  previous_versions: Array<{ video_url: string; created_at: string; script: string }>
  error_message: string | null
  created_at: string
  updated_at: string
}

// ── UI constants ────────────────────────────────────────────────────────

export const SCENE_TYPE_LABELS: Record<StudioSceneType, string> = {
  avatar:      'Avatar',
  split:       'Split',
  infographic: 'Infographic',
  demo:        'Demo',
  typography:  'Typography',
  broll:       'B-roll',
}

export const SCENE_TYPE_COLORS: Record<StudioSceneType, string> = {
  avatar:      '#7C3AED', // violet
  split:       '#1D4ED8', // blue
  infographic: '#059669', // emerald
  demo:        '#0891B2', // cyan
  typography:  '#DC2626', // red
  broll:       '#B45309', // amber
}

export const SCENE_TYPE_DESCRIPTIONS: Record<StudioSceneType, string> = {
  avatar:      'Talking head — straight avatar on plain background. For intros, conclusions, direct statements.',
  split:       'Avatar PiP + right-side Remotion animation. For concept explanations with visuals.',
  infographic: 'Animated chart / stats / counter with voiceover. For data, comparisons, step breakdowns.',
  demo:        'Animated tutorial / how-to with cursor + highlights. For product walkthroughs.',
  typography:  'Kinetic text with voiceover. For quotes, summaries, punchy bullet lists.',
  broll:       'Stock footage from Pexels with voiceover. For ambiance, context shots.',
}
