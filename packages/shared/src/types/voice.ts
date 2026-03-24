export interface PublicVoice {
  voice_id: string
  name: string
  category: string
  description?: string
  labels?: Record<string, string>
  preview_url?: string
}

export interface ClonedVoice {
  id: string
  user_id: string
  name: string
  elevenlabs_voice_id: string
  created_at: string
}

export interface CloneVoicePayload {
  name: string
  sample_url: string
}
