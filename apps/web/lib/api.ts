import { createBrowserClient } from './supabase'
import type {
  CreateFacelessVideoPayload,
  CreateMotionVideoPayload,
  RegenerateScenePayload,
  CheckoutPayload,
  MonerooCheckoutPayload,
  CloneVoicePayload,
  BrandKit,
  CreateBrandKitPayload,
  UpdateBrandKitPayload,
} from '@clyro/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Récupère le token JWT Supabase de la session courante
 */
async function getAuthToken(): Promise<string> {
  const supabase = createBrowserClient()

  // 1. Tenter de récupérer la session en cache
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  // Only use cached token if it has at least 60 seconds left before expiry
  const nowSec = Math.floor(Date.now() / 1000)
  if (session?.access_token && (!session.expires_at || session.expires_at > nowSec + 60)) {
    return session.access_token
  }

  // 2. Token absent ou expiré → refresh silencieux
  console.warn('[getAuthToken] Token absent ou expiré, tentative de refresh…')
  const {
    data: { session: refreshed },
    error: refreshError,
  } = await supabase.auth.refreshSession()

  if (refreshError || !refreshed) {
    console.error('[getAuthToken] Refresh échoué:', refreshError?.message ?? error?.message)
    throw new Error('Session expirée — veuillez vous reconnecter')
  }

  return refreshed.access_token
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
  return apiFetch<{
    video_id: string
    status: string
    script_condensed?: {
      originalWordCount?: number
      condensedWordCount?: number
      overflowPct?: number
      condensed?: boolean
    }
  }>('/api/v1/pipeline/faceless', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function regenerateFacelessScene(payload: RegenerateScenePayload) {
  return apiFetch<{ data: { scene_id: string; image_url: string; prompt_used: string } }>('/api/v1/pipeline/faceless/scene', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function regenerateFacelessClip(payload: {
  video_id: string
  scene_id: string
  image_url: string
  animation_prompt?: string
  duration?: '5' | '10'
}) {
  return apiFetch<{ scene_id: string; clip_url: string; model: string }>('/api/v1/pipeline/faceless/clip', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Lance un réassemblage de la vidéo finale. L'API répond immédiatement
 * en 202 Accepted avec status='assembly'. La fin du traitement est
 * propagée au front via `useVideoStatus` (Supabase realtime + SSE) qui
 * détecte le passage à `done` (avec `output_url`) ou `error`.
 */
export async function reassembleFacelessVideo(videoId: string) {
  return apiFetch<{ status: 'assembly'; video_id: string }>('/api/v1/pipeline/faceless/reassemble', {
    method: 'POST',
    body: JSON.stringify({ video_id: videoId }),
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

export async function updateVideoMetadata(id: string, metadata: Record<string, unknown>) {
  return apiFetch<{ success: boolean }>(`/api/v1/videos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ metadata }),
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
  language?: string
  languageFlag?: string
  age: string
  useCase: string
  description: string
  isFavorite?: boolean
}

export interface VoiceFilters {
  gender?: string
  accent?: string
  language?: string
  useCase?: string
  search?: string
}

export async function getVoices() {
  return apiFetch<{ public: ClyroVoice[]; personal: unknown[] }>('/api/v1/voices')
}

export async function getPublicVoices(filters?: VoiceFilters) {
  const params = new URLSearchParams()
  if (filters?.gender)   params.set('gender',   filters.gender)
  if (filters?.accent)   params.set('accent',   filters.accent)
  if (filters?.language) params.set('language', filters.language)
  if (filters?.useCase)  params.set('useCase',  filters.useCase)
  if (filters?.search)   params.set('search',   filters.search)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<{ voices: ClyroVoice[] }>(`/api/v1/voices/public${query}`)
}

export async function getVoiceFilters() {
  return apiFetch<{
    genders: string[]
    languages: Array<{ value: string; label: string; flag: string }>
    useCases: string[]
  }>('/api/v1/voices/filters')
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

// ---- Brand Kits ----

export async function getBrandKits() {
  return apiFetch<{ data: BrandKit[] }>('/api/v1/brand-kits')
}

export async function createBrandKit(payload: CreateBrandKitPayload) {
  return apiFetch<{ data: BrandKit }>('/api/v1/brand-kits', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateBrandKit({ id, ...payload }: UpdateBrandKitPayload) {
  return apiFetch<{ data: BrandKit }>(`/api/v1/brand-kits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandKit(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand-kits/${id}`, {
    method: 'DELETE',
  })
}

// ---- Brand Asset Generation ----

export interface BrandAsset {
  id: string
  brand_kit_id: string
  user_id: string
  type: 'logo' | 'social_post' | 'banner' | 'thumbnail'
  platform: string | null
  prompt: string
  image_url: string
  created_at: string
}

export type BrandAssetType = 'logo' | 'social_post'
export type SocialPlatform = 'instagram_post' | 'instagram_story' | 'linkedin' | 'twitter' | 'youtube_thumb' | 'tiktok'

export async function generateBrandAsset(payload: {
  brand_kit_id: string
  type: BrandAssetType
  prompt: string
  platform?: SocialPlatform
}) {
  return apiFetch<{ data: BrandAsset }>('/api/v1/brand/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getBrandAssets(brandKitId: string, type?: BrandAssetType) {
  const query = type ? `?type=${type}` : ''
  return apiFetch<{ data: BrandAsset[] }>(`/api/v1/brand/${brandKitId}/assets${query}`)
}

export async function deleteBrandAsset(assetId: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/assets/${assetId}`, { method: 'DELETE' })
}

// ---- Brand Asset Upload ----

export async function uploadBrandLogo(file: File, userId: string): Promise<string> {
  const { createBrowserClient } = await import('./supabase')
  const supabase = createBrowserClient()
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('brand-assets').upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw new Error(error.message)

  const { data: signed } = await supabase.storage
    .from('brand-assets')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  if (!signed?.signedUrl) throw new Error('Failed to get logo URL')
  return signed.signedUrl
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

// ---- F5 Studio ----

export interface StudioAnalyzePayload {
  inputType: 'script' | 'youtube_url'
  value: string
  language?: string
  title?: string
  avatarId?: string
  voiceId?: string
  format?: '16_9' | '9_16' | 'both'
}

export async function analyzeStudio(payload: StudioAnalyzePayload) {
  return apiFetch<{
    projectId: string
    suggestedTitle: string
    totalDurationEst: number
    sceneCount: number
  }>('/api/v1/pipeline/studio/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function generateAllStudioScenes(projectId: string) {
  return apiFetch<{ projectId: string; status: string }>(
    '/api/v1/pipeline/studio/generate-all',
    { method: 'POST', body: JSON.stringify({ projectId }) },
  )
}

export async function regenerateStudioScene(payload: {
  projectId: string
  sceneId: string
  feedback?: string
  newScript?: string
  newType?: string
}) {
  return apiFetch<{ status: string }>(
    '/api/v1/pipeline/studio/regenerate-scene',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function reorderStudioScenes(projectId: string, sceneIds: string[]) {
  return apiFetch<{ success: boolean }>(
    '/api/v1/pipeline/studio/reorder',
    { method: 'PATCH', body: JSON.stringify({ projectId, sceneIds }) },
  )
}

export async function addStudioScene(payload: {
  projectId: string
  afterIndex: number
  type?: string
  script?: string
  hint?: string
}) {
  return apiFetch<{ sceneId: string }>(
    '/api/v1/pipeline/studio/add-scene',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function deleteStudioScene(sceneId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/v1/pipeline/studio/scene/${sceneId}`,
    { method: 'DELETE' },
  )
}

export interface StudioAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  premium?: boolean
  avatar_type?: string
  /**
   * HeyGen's native grouping ID. When present, avatars sharing the same
   * group_id are variants of the same persona (different outfits, angles,
   * etc.). We prefer this over the regex-based name parsing because HeyGen
   * guarantees it's canonical, whereas the regex can misfire on names that
   * happen to contain "look" or "(v2)" substrings for unrelated reasons.
   */
  group_id?: string
  looks_count: number
  looks: Array<{
    look_id: string
    name: string
    preview_image_url: string
    preview_video_url?: string
  }>
  tags: string[]
  category: 'professional' | 'lifestyle' | 'ugc' | 'community' | 'other'
}

export async function getStudioAvatars() {
  return apiFetch<{
    avatars: StudioAvatar[]
    categories: string[]
  }>('/api/v1/pipeline/studio/avatars')
}

export async function getStudioProject(projectId: string) {
  return apiFetch<{ project: unknown; scenes: unknown[] }>(
    `/api/v1/pipeline/studio/projects/${projectId}`,
  )
}

// F5-011: kicks off the final render. Returns 202 + status='rendering'
// almost immediately; the actual MP4 lands on studio_projects via Realtime.
export async function renderStudioFinal(projectId: string, format?: '16_9' | '9_16') {
  return apiFetch<{
    status: 'rendering'
    projectId: string
    sceneCount: number
    format: '16_9' | '9_16'
  }>('/api/v1/pipeline/studio/render-final', {
    method: 'POST',
    body: JSON.stringify({ projectId, format }),
  })
}

