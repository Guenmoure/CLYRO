export type VideoModule = 'faceless' | 'motion'
export type VideoStatus = 'pending' | 'processing' | 'storyboard' | 'visuals' | 'audio' | 'assembly' | 'done' | 'error'

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

export interface Scene {
  id: string
  index: number
  description_visuelle: string
  texte_voix: string
  duree_estimee: number
  image_url?: string
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

export interface CreateFacelessVideoPayload {
  title: string
  style: FacelessStyle
  input_type: 'script' | 'audio'
  script?: string
  audio_url?: string
  voice_id?: string
  brand_kit_id?: string
}

export interface CreateMotionVideoPayload {
  title: string
  brief: string
  format: VideoFormat
  duration: VideoDuration
  style: MotionStyle
  brand_config: BrandConfig
  voice_id?: string
}
