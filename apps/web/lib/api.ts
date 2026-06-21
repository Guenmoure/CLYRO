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

/** Typed API error — preserves the machine-readable `code` from the response. */
export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

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
 * Wrapper fetch avec authentification automatique.
 *
 * Audit 19/06/26 B1+B5 — added a hard timeout (30 s default) via
 * AbortController so a hung upstream (HeyGen /v2/avatars latency, Render
 * cold start, Anthropic 5xx pending forever) doesn't strand the UI in a
 * permanent skeleton state. The previous version had no timeout at all,
 * which is exactly what caused the Avatars gallery to stay loading
 * forever on slow HeyGen calls. The Promise NEVER resolved → the caller's
 * `.finally(setLoading(false))` never fired → the page locked.
 *
 * Long-running flows (e.g. storyboard chunked generation, photoshoot
 * batch render) pass a larger `timeoutMs` via `options`.
 */
interface ApiFetchOptions extends RequestInit {
  /** Override the default 30 s timeout for long-running calls. */
  timeoutMs?: number
}

async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options
  const token = await getAuthToken()

  // Wire an AbortController so the fetch gives up after `timeoutMs`.
  // The signal is composed with any caller-supplied signal so cancelation
  // still works (e.g. React unmount calling controller.abort()).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const callerSignal = fetchOptions.signal
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    })
  } catch (networkErr) {
    // Disambiguate timeout from network failure for the caller.
    if (networkErr instanceof DOMException && networkErr.name === 'AbortError') {
      console.error('[apiFetch] Timeout after', timeoutMs, 'ms on', API_URL + path)
      throw new ApiError('Request timed out', 'TIMEOUT', 0)
    }
    console.error('[apiFetch] Network error reaching', API_URL + path, networkErr)
    throw new ApiError(
      'Impossible de joindre le serveur API. Vérifie ta connexion ou réessaie dans quelques instants.',
      'NETWORK_ERROR',
      0,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: 'Erreur réseau',
      code: 'NETWORK_ERROR',
    }))
    throw new ApiError(
      errorBody.error ?? `HTTP ${response.status}`,
      errorBody.code ?? 'UNKNOWN',
      response.status,
    )
  }

  return response.json() as Promise<T>
}

// ---- URL-to-Script (audit P2: Pictory-style blog-to-video) ----

export interface UrlToScriptPayload {
  url: string
  length?: 'short' | 'medium' | 'long'
  language?: 'fr' | 'en'
}

export interface UrlToScriptResponse {
  source: {
    url: string
    finalUrl: string
    title: string
    description: string
    wordCount: number
    language?: string
  }
  title: string
  script: string
  hook: string
  cta: string
  estimatedSeconds: number
  wordCount: number
  attribution: string
}

export async function generateScriptFromUrl(payload: UrlToScriptPayload) {
  return apiFetch<UrlToScriptResponse>('/api/v1/generate/script-from-url', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export interface CreateMotionDesignPayload {
  title:    string
  brief:    string
  format:   '16_9' | '9_16' | '1_1'
  duration: string
  /** Visual register from the wizard's style picker — biases Claude's scene
   *  type selection (corporate→trust, dynamique→fast, luxe→cinematic, fun→playful). */
  style?:   'corporate' | 'dynamique' | 'luxe' | 'fun'
  brand_config: {
    primary_color:   string
    secondary_color?: string
    /** Optional brand font (e.g. "Inter, sans-serif"). The MotionDesign
     *  components fall back to system sans when omitted. */
    font_family?:    string
    logo_url?:       string
  }
  voice_id?:      string
  music_url?:     string
  music_track_id?: string
  /**
   * Existing wizard draft id. When present, the backend promotes the
   * draft row in place (status='draft' → 'pending') instead of inserting
   * a fresh sibling row. Eliminates the "completed video + zombie draft"
   * duplication.
   */
  draft_id?:      string
}

export async function startMotionDesignGeneration(payload: CreateMotionDesignPayload) {
  return apiFetch<{ video_id: string; status: string }>('/api/v1/pipeline/motion/design', {
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

/**
 * Annule une génération en cours. Le backend retire le job de la queue
 * (ou laisse le pipeline coopérer s'il est déjà actif), passe la vidéo
 * en status='cancelled' et rembourse la TOTALITÉ des crédits déduits
 * (refund idempotent côté DB). 409 ALREADY_FINISHED si la vidéo est
 * déjà terminée.
 */
export async function cancelVideo(videoId: string) {
  return apiFetch<{ cancelled: boolean; credits_refunded: number }>(`/api/v1/videos/${videoId}/cancel`, {
    method: 'POST',
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

export async function getBrandKit(id: string) {
  return apiFetch<{ data: BrandKit }>(`/api/v1/brand-kits/${id}`)
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

// ---- Brand Catalog (Phase 2) ----

import type { CatalogItem as SharedCatalogItem, CatalogScrapeDraft, BrandMediaItem } from '@clyro/shared'

export type BrandCatalogItem = SharedCatalogItem
export type { CatalogScrapeDraft, BrandMediaItem }

export async function listBrandCatalog(brandKitId: string) {
  return apiFetch<{ data: SharedCatalogItem[] }>(`/api/v1/brand/${brandKitId}/catalog`)
}

export async function createBrandCatalogItem(payload: {
  brand_kit_id: string
  name: string
  image_url: string
  description?: string
  category?: string
}) {
  return apiFetch<{ data: SharedCatalogItem }>('/api/v1/brand/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function scrapeBrandCatalogFromUrl(payload: { brand_kit_id: string; url: string }) {
  return apiFetch<{ data: CatalogScrapeDraft }>('/api/v1/brand/catalog/from-url', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandCatalogItem(itemId: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/catalog/${itemId}`, { method: 'DELETE' })
}

// ---- Brand Media Library (Phase 2) ----

export async function listBrandMedia(brandKitId: string) {
  return apiFetch<{ data: BrandMediaItem[] }>(`/api/v1/brand/${brandKitId}/media`)
}

export async function registerBrandMedia(payload: {
  brand_kit_id: string
  storage_path: string
  filename: string
  mime_type: BrandMediaItem['mime_type']
  size_bytes: number
  tags?: string[]
  width?: number
  height?: number
}) {
  return apiFetch<{ data: BrandMediaItem }>('/api/v1/brand/media/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function importBrandMediaFromUrl(payload: { brand_kit_id: string; url: string; tags?: string[] }) {
  return apiFetch<{ data: BrandMediaItem }>('/api/v1/brand/media/from-url', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandMedia(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/media/${id}`, { method: 'DELETE' })
}

// ---- Brand Campaigns persistant (Phase 3.1) ----

import type {
  BrandCampaign,
  BrandCreative,
  CampaignAspectRatio,
  CampaignWithCreatives,
  CreateCampaignPayload,
  UpdateCreativePayload,
} from '@clyro/shared'

export type { BrandCampaign, BrandCreative, CampaignAspectRatio, CampaignWithCreatives, CreateCampaignPayload, UpdateCreativePayload }

export async function listBrandCampaigns(brandKitId: string) {
  return apiFetch<{ data: BrandCampaign[] }>(`/api/v1/brand/campaigns?brand_kit_id=${encodeURIComponent(brandKitId)}`)
}

export async function getBrandCampaign(id: string) {
  return apiFetch<{ data: CampaignWithCreatives }>(`/api/v1/brand/campaigns/${id}`)
}

export async function createBrandCampaign(payload: CreateCampaignPayload) {
  return apiFetch<{ data: { campaign: BrandCampaign } }>('/api/v1/brand/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandCampaign(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/campaigns/${id}`, { method: 'DELETE' })
}

export async function updateBrandCreative(id: string, payload: UpdateCreativePayload) {
  return apiFetch<{ data: BrandCreative }>(`/api/v1/brand/creatives/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandCreative(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/creatives/${id}`, { method: 'DELETE' })
}

export interface CampaignSuggestion {
  title:       string
  description: string
  prompt:      string
}

export async function suggestBrandCampaigns(brandKitId: string, count?: number) {
  return apiFetch<{ data: CampaignSuggestion[] }>('/api/v1/brand/campaigns/suggest', {
    method: 'POST',
    body: JSON.stringify({ brand_kit_id: brandKitId, count }),
  })
}

export async function addCreativeToBrandCampaign(campaignId: string) {
  return apiFetch<{ data: { creative: BrandCreative } }>(`/api/v1/brand/campaigns/${campaignId}/creatives`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function animateBrandCreative(creativeId: string) {
  return apiFetch<{ data: { video_id: string; status: string; credits_deducted: number } }>(
    `/api/v1/brand/creatives/${creativeId}/animate`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

// ---- Creative Editor — Phase 3.4 ----
import type { BrandCreativeVersion } from '@clyro/shared'
export type { BrandCreativeVersion }

export async function getBrandCreative(id: string) {
  return apiFetch<{ data: { creative: BrandCreative; campaign: BrandCampaign } }>(
    `/api/v1/brand/creatives/${id}`,
  )
}

export async function listBrandCreativeVersions(creativeId: string) {
  return apiFetch<{ data: BrandCreativeVersion[] }>(`/api/v1/brand/creatives/${creativeId}/versions`)
}

export async function saveBrandCreativeVersion(creativeId: string) {
  return apiFetch<{ data: BrandCreativeVersion }>(`/api/v1/brand/creatives/${creativeId}/versions`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function restoreBrandCreativeVersion(creativeId: string, versionNum: number) {
  return apiFetch<{ data: BrandCreative }>(`/api/v1/brand/creatives/${creativeId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version_num: versionNum }),
  })
}

export async function generateCtaVariants(creativeId: string) {
  return apiFetch<{ data: string[] }>(`/api/v1/brand/creatives/${creativeId}/cta-variants`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function regenerateBrandCreativeImage(creativeId: string, prompt: string) {
  return apiFetch<{ data: BrandCreative }>(`/api/v1/brand/creatives/${creativeId}/regenerate-image`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
}

export async function fixBrandCreativeLayout(creativeId: string) {
  return apiFetch<{ data: BrandCreative }>(`/api/v1/brand/creatives/${creativeId}/fix-layout`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ---- Brand Book (Phase 5) ----
import type { BrandBook } from '@clyro/shared'
export type { BrandBook }

export async function getBrandBook(brandKitId: string) {
  return apiFetch<{ data: BrandBook }>(`/api/v1/brand/book?brand_kit_id=${encodeURIComponent(brandKitId)}`)
}

export async function generateBrandBook(brandKitId: string) {
  return apiFetch<{ data: BrandBook }>('/api/v1/brand/book', {
    method: 'POST',
    body: JSON.stringify({ brand_kit_id: brandKitId }),
  })
}

export async function publishBrandBook(bookId: string) {
  return apiFetch<{ data: BrandBook }>(`/api/v1/brand/book/${bookId}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function unpublishBrandBook(bookId: string) {
  return apiFetch<{ data: BrandBook }>(`/api/v1/brand/book/${bookId}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ---- Brand Photoshoots (Phase 4) ----
import type {
  BrandPhotoshoot, BrandPhotoshootTemplateInfo, PhotoshootMode, PhotoshootAspectRatio,
} from '@clyro/shared'
export type { BrandPhotoshoot, BrandPhotoshootTemplateInfo, PhotoshootMode, PhotoshootAspectRatio }

export async function listBrandPhotoshootTemplates() {
  return apiFetch<{ data: BrandPhotoshootTemplateInfo[] }>('/api/v1/brand/photoshoots/templates')
}

export async function listBrandPhotoshoots(brandKitId: string) {
  return apiFetch<{ data: BrandPhotoshoot[] }>(`/api/v1/brand/${brandKitId}/photoshoots`)
}

export async function getBrandPhotoshoot(id: string) {
  return apiFetch<{ data: BrandPhotoshoot }>(`/api/v1/brand/photoshoots/${id}`)
}

export async function createBrandPhotoshoot(payload: {
  brand_kit_id:    string
  mode:            PhotoshootMode
  input_image_url?: string
  reference_urls?: string[]
  template_id?:    string
  prompt?:         string
  aspect_ratio?:   PhotoshootAspectRatio
}) {
  return apiFetch<{ data: BrandPhotoshoot }>('/api/v1/brand/photoshoots', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteBrandPhotoshoot(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/photoshoots/${id}`, { method: 'DELETE' })
}

export async function animateBrandPhotoshoot(photoshootId: string, index: number) {
  return apiFetch<{ data: { video_id: string; status: string; credits_deducted: number } }>(
    `/api/v1/brand/photoshoots/${photoshootId}/animate/${index}`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

// ---- Autopilot series ----

export type AutopilotCadence = 'daily' | 'weekly' | 'manual'

export interface AutopilotSeries {
  id:             string
  user_id:        string
  name:           string
  topic:          string
  style:          string
  cadence:        AutopilotCadence
  voice_id:       string | null
  brand_kit_id:   string | null
  format:         '9:16' | '16:9' | '1:1'
  duration:       number
  language:       string
  enabled:        boolean
  next_run_at:    string
  last_run_at:    string | null
  last_video_id:  string | null
  run_count:      number
  created_at:     string
  updated_at:     string
}

export interface CreateAutopilotPayload {
  name:          string
  topic:         string
  style?:        string
  cadence?:      AutopilotCadence
  voice_id?:     string
  brand_kit_id?: string
  format?:       '9:16' | '16:9' | '1:1'
  duration?:     number
  language?:     string
  enabled?:      boolean
}

export type UpdateAutopilotPayload = Partial<CreateAutopilotPayload>

export async function getAutopilotSeries() {
  return apiFetch<{ data: AutopilotSeries[] }>('/api/v1/autopilot')
}

export async function createAutopilotSeries(payload: CreateAutopilotPayload) {
  return apiFetch<{ data: AutopilotSeries }>('/api/v1/autopilot', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAutopilotSeries(id: string, payload: UpdateAutopilotPayload) {
  return apiFetch<{ data: AutopilotSeries }>(`/api/v1/autopilot/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteAutopilotSeries(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/autopilot/${id}`, {
    method: 'DELETE',
  })
}

export async function runAutopilotSeries(id: string) {
  return apiFetch<{ data: AutopilotSeries; queued: boolean }>(`/api/v1/autopilot/${id}/run`, {
    method: 'POST',
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

// ---- Product Catalog ----

export interface CatalogItem {
  id: string
  brand_kit_id: string
  user_id: string
  name: string
  description: string | null
  image_url: string
  category: string | null
  created_at: string
}

export async function getCatalogItems(brandKitId: string) {
  return apiFetch<{ data: CatalogItem[] }>(`/api/v1/brand/${brandKitId}/catalog`)
}

export async function addCatalogItem(payload: {
  brand_kit_id: string
  name: string
  description?: string
  image_url: string
  category?: string
}) {
  return apiFetch<{ data: CatalogItem }>('/api/v1/brand/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCatalogItem(itemId: string, payload: Partial<{ name: string; description: string; image_url: string; category: string }>) {
  return apiFetch<{ data: CatalogItem }>(`/api/v1/brand/catalog/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteCatalogItem(itemId: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/brand/catalog/${itemId}`, { method: 'DELETE' })
}

// ---- Campaigns ----

export interface CampaignConcept {
  name: string
  tagline: string
  description: string
  platforms: string[]
  suggested_posts: Array<{ platform: string; copy: string; visual_direction: string }>
}

export interface CampaignAsset {
  platform: string
  image_url: string
  copy: string
}

export async function generateCampaignIdeas(payload: {
  brand_kit_id: string
  goal: string
  catalog_item_ids?: string[]
  platforms: string[]
}) {
  return apiFetch<{ campaigns: CampaignConcept[] }>('/api/v1/brand/campaigns/ideate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function generateCampaignAssets(payload: {
  brand_kit_id: string
  campaign: { name: string; posts: Array<{ platform: string; copy: string; visual_direction: string; catalog_item_id?: string }> }
}) {
  return apiFetch<{ assets: CampaignAsset[] }>('/api/v1/brand/campaigns/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Photoshoot ----

export type PhotoshootTemplate = 'studio' | 'floating' | 'ingredient' | 'in_use'

export async function generatePhotoshoot(payload: {
  brand_kit_id: string
  source_image_url: string
  template: PhotoshootTemplate
  custom_prompt?: string
  catalog_item_id?: string
}) {
  return apiFetch<{ data: { id: string; image_url: string; template: string; prompt_used: string } }>('/api/v1/brand/photoshoot', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Animate ----

export type MotionType = 'zoom_in' | 'pan_left' | 'pan_right' | 'zoom_out' | 'orbit' | 'pulse'

export async function animateAsset(payload: {
  brand_kit_id: string
  source_image_url: string
  motion_type: MotionType
  duration?: '3' | '5'
}) {
  return apiFetch<{ data: { id: string; video_url: string; motion_type: string } }>('/api/v1/brand/animate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Brand Agent Chat ----

export interface BrandAgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BrandSuggestions {
  name?: string
  primary_color?: string
  secondary_color?: string
  font_heading?: string
  font_body?: string
  tagline?: string
  tone?: string
}

export async function chatWithBrandAgent(payload: {
  brand_kit_id?: string
  messages: BrandAgentMessage[]
  context?: {
    name?: string
    industry?: string
    target_audience?: string
    values?: string
    existing_colors?: { primary?: string; secondary?: string }
  }
}) {
  return apiFetch<{ reply: string; suggestions?: BrandSuggestions }>('/api/v1/brand/agent/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---- Background Editor ----

export async function editBackground(payload: {
  source_image_url: string
  background_prompt: string
  brand_kit_id?: string
}) {
  const res = await fetch('/api/brand-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Background edit failed' }))
    throw new Error(err.error)
  }
  return res.json() as Promise<{ foreground_url: string; background_url: string; composite_prompt: string }>
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

export interface VideoStatusEvent {
  status: string
  progress?: number
  /** Human-readable failure reason emitted by the pipeline when status === 'error'. */
  error_message?: string | null
}

export function subscribeToVideoStatus(
  videoId: string,
  token: string,
  onUpdate: (data: VideoStatusEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const url = `${API_URL}/api/v1/videos/${videoId}/status?token=${encodeURIComponent(token)}`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data as string) as VideoStatusEvent
      onUpdate(data)
      // 'cancelled' is terminal, like done/error — the server closes its
      // side too, but closing here avoids a useless reconnect attempt.
      if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
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
  /** When true, the worker wraps each HeyGen avatar scene in a HyperFrames
   *  composition (lower-third, vignette, brand color) before final concat. */
  useHyperframes?: boolean
  /** Template name for HyperFrames enrichment. Default 'avatar-lower-third'. */
  hyperframesTemplate?:
    | 'avatar-lower-third'
    | 'avatar-intro-card'
    | 'avatar-pip'
    | 'avatar-tiktok'
    | 'avatar-instagram'
    | 'avatar-logo-outro'
  /** Brand primary color for the lower-third / intro-card. Falls back to
   *  HeyGen background color, then CLYRO blue. */
  brandColor?: string
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

// ── AI Writing helper — Wave 3 of the 16/06/26 UI/UX audit ─────────────────

export type PolishGoal = 'tighten' | 'punchier' | 'simpler'

export interface PolishScriptPayload {
  script:    string
  language?: 'en' | 'fr'
  goal?:     PolishGoal
}

export interface PolishScriptResult {
  polished_script: string
  original_words:  number
  new_words:       number
}

/**
 * Polish a script via Claude. Costs 1 credit per call (server-side
 * deduction, refunded on failure). Audit 16/06/26 Wave 3 — « ajouter
 * une aide à la rédaction par IA ».
 */
export async function polishScript(payload: PolishScriptPayload): Promise<PolishScriptResult> {
  return apiFetch<PolishScriptResult>('/api/v1/ai/polish-script', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── Pre-flight script quality check — Audit P3.3 ────────────────────────────

export type ScriptIssueType =
  | 'weak_cta' | 'slow_hook' | 'repetition' | 'vague_language'
  | 'too_short' | 'too_long'

export interface ScriptIssue {
  type:        ScriptIssueType
  severity:    'warning' | 'info'
  message:     string
  suggestion?: string
}

export interface ScriptCheckResult {
  issues:        ScriptIssue[]
  language:      'en' | 'fr'
  word_count:    number
}

export interface ScriptCheckPayload {
  script:    string
  language?: 'en' | 'fr'
}

/**
 * Pre-flight script quality check. FREE call — Haiku 4.5 backend.
 * Returns concrete issues (weak CTA, slow hook, repetition, vague language,
 * length guards). Never rewrites the script — the user keeps full control.
 */
export async function checkScript(payload: ScriptCheckPayload): Promise<ScriptCheckResult> {
  return apiFetch<ScriptCheckResult>('/api/v1/ai/script-check', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── Brand DNA inference from URL — Audit P3.2 ───────────────────────────────

export interface BrandDNAInference {
  tagline:             string | null
  primary_color:       string | null
  secondary_color:     string | null
  brand_values:        string[]
  brand_aesthetic:     string[]
  brand_tone_of_voice: string[]
  business_overview:   string | null
  language:            'en' | 'fr' | 'es' | 'de' | 'pt'
  source_url:          string
  source_title:        string
}

/**
 * Infer a brand DNA from a public URL. Costs 5 credits (server-side
 * deduction, refunded on failure). Sonnet-powered. Surface in the brand
 * kit wizard as an « Infer from URL » shortcut.
 */
export async function inferBrandFromUrl(url: string): Promise<BrandDNAInference> {
  return apiFetch<BrandDNAInference>('/api/v1/brand/infer-from-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

