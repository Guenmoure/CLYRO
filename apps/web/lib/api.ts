import { createBrowserClient } from './supabase'
import type {
  CreateFacelessVideoPayload,
  CreateMotionVideoPayload,
  RegenerateScenePayload,
  CheckoutPayload,
  MonerooCheckoutPayload,
  CloneVoicePayload,
} from '@clyro/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Récupère le token JWT Supabase de la session courante
 */
async function getAuthToken(): Promise<string> {
  const supabase = createBrowserClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    throw new Error('Session expirée — veuillez vous reconnecter')
  }

  return session.access_token
}

/**
 * Wrapper fetch avec authentification automatique
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: 'Erreur réseau',
      code: 'NETWORK_ERROR',
    }))
    throw new Error(errorBody.error ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

// ---- Pipeline Faceless ----

export async function startFacelessGeneration(payload: CreateFacelessVideoPayload) {
  return apiFetch<{ video_id: string; status: string }>('/api/v1/pipeline/faceless', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function regenerateFacelessScene(payload: RegenerateScenePayload) {
  return apiFetch<{ scene: unknown }>('/api/v1/pipeline/faceless/scene', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Pipeline Motion ----

export async function startMotionGeneration(payload: CreateMotionVideoPayload) {
  return apiFetch<{ video_id: string; status: string }>('/api/v1/pipeline/motion', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Videos ----

export async function getVideos() {
  return apiFetch<{ data: unknown[] }>('/api/v1/videos')
}

export async function getVideo(id: string) {
  return apiFetch<{ data: unknown }>(`/api/v1/videos/${id}`)
}

export async function deleteVideo(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/videos/${id}`, {
    method: 'DELETE',
  })
}

// ---- Voices ----

export interface ClyroVoice {
  id: string
  name: string
  previewUrl: string | null
  category: string
  gender: string
  accent: string
  age: string
  useCase: string
  description: string
  isFavorite?: boolean
}

export interface VoiceFilters {
  gender?: string
  accent?: string
  useCase?: string
  search?: string
}

export async function getVoices() {
  return apiFetch<{ public: ClyroVoice[]; personal: unknown[] }>('/api/v1/voices')
}

export async function getPublicVoices(filters?: VoiceFilters) {
  const params = new URLSearchParams()
  if (filters?.gender)  params.set('gender',  filters.gender)
  if (filters?.accent)  params.set('accent',  filters.accent)
  if (filters?.useCase) params.set('useCase', filters.useCase)
  if (filters?.search)  params.set('search',  filters.search)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<{ voices: ClyroVoice[] }>(`/api/v1/voices/public${query}`)
}

export async function getVoiceFilters() {
  return apiFetch<{ genders: string[]; accents: string[]; useCases: string[] }>('/api/v1/voices/filters')
}

export async function toggleVoiceFavorite(voiceId: string, action: 'add' | 'remove') {
  return apiFetch<{ success: boolean }>('/api/v1/voices/favorites', {
    method: 'POST',
    body: JSON.stringify({ voiceId, action }),
  })
}

export async function cloneVoice(payload: CloneVoicePayload) {
  return apiFetch<{ voice_id: string }>('/api/v1/voices/clone', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteVoice(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/voices/${id}`, {
    method: 'DELETE',
  })
}

// ---- Checkout ----

export async function createStripeCheckout(payload: CheckoutPayload) {
  return apiFetch<{ checkout_url: string }>('/api/v1/checkout/stripe', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createMonerooCheckout(payload: MonerooCheckoutPayload) {
  return apiFetch<{ payment_url: string }>('/api/v1/checkout/moneroo', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- SSE Video Status ----

export function subscribeToVideoStatus(
  videoId: string,
  token: string,
  onUpdate: (data: { status: string; progress?: number }) => void,
  onError?: (error: Event) => void
): EventSource {
  const url = `${API_URL}/api/v1/videos/${videoId}/status?token=${encodeURIComponent(token)}`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data as string) as { status: string; progress?: number }
      onUpdate(data)
      if (data.status === 'done' || data.status === 'error') {
        eventSource.close()
      }
    } catch {
      // ignore parse errors
    }
  }

  if (onError) {
    eventSource.onerror = onError
  }

  return eventSource
}
