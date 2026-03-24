import type { Scene } from './video'

export interface StoryboardResult {
  scenes: Scene[]
  total_duration: number
}

export interface GenerateImageResult {
  scene_id: string
  image_url: string
  prompt_used: string
}

export interface PipelineJobResponse {
  video_id: string
  status: 'pending' | 'started'
}

export interface RegenerateScenePayload {
  video_id: string
  scene_id: string
  prompt_override?: string
}

export interface ApiError {
  error: string
  code: string
}

export interface ApiSuccess<T> {
  data: T
}
