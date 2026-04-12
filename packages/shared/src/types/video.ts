export type VideoModule = 'faceless' | 'motion'
export type VideoStatus = 'pending' | 'processing' | 'storyboard' | 'visuals' | 'audio' | 'animation' | 'assembly' | 'done' | 'error'

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

export type MotionStyle = 'corporate' | 'dynamique' | 'luxe' | 'fun'
export type VideoFormat = '9:16' | '1:1' | '16:9'
export type VideoDuration = '6s' | '15s' | '30s' | '60s'

export type AnimationType = 'slide-in' | 'zoom' | 'fade' | 'particle-burst' | 'typewriter'
export type SceneType = 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'

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
  format: VideoFormat
  duration: VideoDuration
  style: MotionStyle
  brand_config: BrandConfig
  voice_id?: string
  music_track_id?: string
}
