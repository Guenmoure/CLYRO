import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'

const BASE_URL = 'https://api.elevenlabs.io/v1'

const EL_MAX_RETRIES = 5

/** Rate-limit-aware retry. Detects 429 + `Retry-After` and respects ElevenLabs'
 *  cooldown instead of hammering the API with short backoffs.
 *
 *  Backoff schedule on generic errors : 2s, 5s, 10s, 20s.
 *  Sur 429/503 avec Retry-After : on utilise la valeur renvoyée (capped 60s).
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= EL_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt >= EL_MAX_RETRIES) break

      // Extract Retry-After seconds from the thrown RateLimitError (see below)
      const retryAfterSec = (err as { retryAfterSec?: number })?.retryAfterSec
      const baseDelay = [2_000, 5_000, 10_000, 20_000][attempt - 1] ?? 20_000
      const delay = retryAfterSec
        ? Math.min(retryAfterSec * 1_000, 60_000)
        : baseDelay

      logger.warn({
        attempt,
        label,
        delayMs: delay,
        retryAfterSec,
        error: err instanceof Error ? err.message : String(err),
      }, 'ElevenLabs: retrying')
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}
// eleven_turbo_v2_5 : 3× plus rapide que multilingual_v2, latence ~2s/scène vs ~6s
// Garde la qualité voix off pour de courtes durées (30-60s max)
const DEFAULT_MODEL = 'eleven_turbo_v2_5'

// Hard timeout per TTS request. Without this, a stalled ElevenLabs response
// blocks the pipeline at progress=30% indefinitely (Node fetch has no default timeout).
// 120s laisse de la marge pendant que ElevenLabs ralentit sous charge.
const EL_TTS_TIMEOUT_MS = 120_000

// Max concurrent TTS requests. ElevenLabs rate-limits heavy concurrency:
// firing 60 scenes at once on a 15-min video causes most to fail silently,
// producing only ~30s of audio. Batching conservateur (2) pour garantir que
// TOUTES les scènes aboutissent, même sur des vidéos de 20+ min.
// Tunable via EL_TTS_CONCURRENCY env var (set to 1 if ElevenLabs keeps 429'ing).
const EL_TTS_CONCURRENCY = Math.max(1, Number(process.env.EL_TTS_CONCURRENCY ?? 2))

// Si plus de N% des scènes ratent leur TTS après tous les retries, on fait
// échouer le pipeline au lieu de livrer une vidéo muette sur 90% de sa durée.
// Tunable via EL_TTS_MAX_FAILURE_RATIO env var (0..1). Default 0.05 (5%).
const EL_TTS_MAX_FAILURE_RATIO = (() => {
  const raw = Number(process.env.EL_TTS_MAX_FAILURE_RATIO)
  if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw
  return 0.05
})()

/** Erreur typée transportant Retry-After pour que `withRetry` respecte le
 *  cooldown serveur plutôt que de retry aveuglément. */
class RateLimitError extends Error {
  retryAfterSec?: number
  status: number
  constructor(status: number, message: string, retryAfterSec?: number) {
    super(message)
    this.name = 'RateLimitError'
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get('retry-after')
  if (!h) return undefined
  // Retry-After can be "120" (seconds) or an HTTP-date — we only handle seconds
  const n = Number(h)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('Missing ELEVENLABS_API_KEY environment variable')
  return key
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  preview_url: string
  category: 'premade' | 'cloned' | 'generated' | 'professional' | 'high_quality'
  labels: {
    accent?: string
    age?: string
    gender?: string
    use_case?: string
    description?: string
  }
}

export interface ClyroVoice {
  id: string
  name: string
  previewUrl: string
  category: 'public' | 'cloned'
  gender?: string
  accent?: string
  language?: string
  languageFlag?: string
  age?: string
  useCase?: string
  description?: string
}

export interface VoiceFilters {
  gender?: string
  accent?: string
  language?: string
  useCase?: string
  search?: string
}

// Mapping chip frontend → labels ElevenLabs possibles (labels.use_case).
// ElevenLabs renvoie des valeurs variées comme `narrative_story`,
// `social_media`, `characters_animation`, `news_presentation`, etc. On
// matche avec inclusion (pas égalité) et on mappe les variantes courantes.
const USE_CASE_SYNONYMS: Record<string, string[]> = {
  'narration':      ['narration', 'narrative', 'audiobook', 'story', 'documentary'],
  'conversational': ['conversational', 'conversation', 'chat', 'interactive'],
  'characters':     ['characters', 'character', 'animation', 'gaming', 'video game', 'cartoon'],
  'social media':   ['social media', 'social_media', 'social-media', 'social', 'podcast', 'youtube'],
  'educational':    ['educational', 'education', 'training', 'e-learning', 'elearning', 'tutorial'],
  'news':           ['news', 'broadcast', 'presentation', 'informative'],
  'advertisement':  ['advertisement', 'advertising', 'commercial', 'marketing'],
  'entertainment':  ['entertainment', 'entertain', 'tv'],
}

/** Normalize a use-case label: lower-case, strip separators so
 * "social_media" and "Social-Media" collapse to "social media". */
function normalizeUseCase(s: string): string {
  return s.toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
}

// Mapping langue → accents ElevenLabs (labels.accent)
const LANGUAGE_ACCENT_MAP: Record<string, string[]> = {
  'français':    ['french'],
  'english':     ['american', 'british', 'australian', 'irish', 'english'],
  'español':     ['spanish'],
  'português':   ['portuguese', 'brazilian'],
  'deutsch':     ['german'],
  'italiano':    ['italian'],
  'arabic':      ['arabic'],
  'hindi':       ['hindi'],
}

const ACCENT_TO_LANGUAGE: Record<string, { label: string; flag: string }> = {
  french:     { label: 'Français',   flag: '🇫🇷' },
  american:   { label: 'English',    flag: '🇺🇸' },
  british:    { label: 'English',    flag: '🇬🇧' },
  australian: { label: 'English',    flag: '🇦🇺' },
  irish:      { label: 'English',    flag: '🇮🇪' },
  english:    { label: 'English',    flag: '🇬🇧' },
  spanish:    { label: 'Español',    flag: '🇪🇸' },
  portuguese: { label: 'Português',  flag: '🇵🇹' },
  brazilian:  { label: 'Português',  flag: '🇧🇷' },
  german:     { label: 'Deutsch',    flag: '🇩🇪' },
  italian:    { label: 'Italiano',   flag: '🇮🇹' },
  arabic:     { label: 'Arabic',     flag: '🇸🇦' },
  hindi:      { label: 'Hindi',      flag: '🇮🇳' },
}

// ── Shared voice from ElevenLabs library ───────────────────────────────────

interface ElevenLabsSharedVoice {
  voice_id: string
  name: string
  preview_url: string
  category: string
  labels: Record<string, string>  // flat key-value labels
  description?: string
  cloned_by_count?: number
  usage_character_count_1y?: number
}

function normalizeSharedVoice(v: ElevenLabsSharedVoice): ClyroVoice {
  // Shared voices use flat labels like { "accent": "american", "gender": "male", ... }
  const accentKey = (v.labels?.accent ?? '').toLowerCase()
  const langInfo = ACCENT_TO_LANGUAGE[accentKey]
  return {
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url,
    category: 'public',
    gender: v.labels?.gender,
    accent: v.labels?.accent,
    language: langInfo?.label,
    languageFlag: langInfo?.flag,
    age: v.labels?.age,
    useCase: v.labels?.use_case,
    description: v.labels?.description ?? v.description,
  }
}

// ── 1. Fetch ALL voices: account voices + shared library ───────────────────

async function fetchAccountVoices(): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': getApiKey() },
  })
  if (!res.ok) throw new Error(`ElevenLabs /voices error ${res.status}`)
  const data = (await res.json()) as { voices: ElevenLabsVoice[] }
  return data.voices ?? []
}

async function fetchSharedVoices(pageSize = 100, maxPages = 3): Promise<ElevenLabsSharedVoice[]> {
  const all: ElevenLabsSharedVoice[] = []
  let page = 0

  while (page < maxPages) {
    const url = `${BASE_URL}/shared-voices?page_size=${pageSize}&page=${page}`
    const res = await fetch(url, {
      headers: { 'xi-api-key': getApiKey() },
    })
    if (!res.ok) {
      logger.warn({ status: res.status, page }, 'ElevenLabs /shared-voices page failed')
      break
    }
    const data = (await res.json()) as { voices: ElevenLabsSharedVoice[]; has_more?: boolean; last_sort_id?: string }
    const voices = data.voices ?? []
    all.push(...voices)

    // Stop if no more pages or fewer results than page size
    if (!data.has_more || voices.length < pageSize) break
    page++
  }

  return all
}

export async function listPublicVoices(filters?: VoiceFilters): Promise<ClyroVoice[]> {
  try {
    // Fetch account voices and shared library in parallel
    const [accountVoices, sharedVoices] = await Promise.all([
      fetchAccountVoices(),
      fetchSharedVoices(),
    ])

    logger.info({
      accountCount: accountVoices.length,
      sharedCount: sharedVoices.length,
      accountCategories: [...new Set(accountVoices.map(v => v.category))],
    }, 'ElevenLabs voices loaded')

    // Normalize both sets
    const normalizedAccount = accountVoices.map(normalizeVoice)
    const normalizedShared = sharedVoices.map(normalizeSharedVoice)

    // Merge and deduplicate (account voices take priority)
    const seenIds = new Set(normalizedAccount.map((v) => v.id))
    const merged = [
      ...normalizedAccount,
      ...normalizedShared.filter((v) => !seenIds.has(v.id)),
    ]

    let voices = merged

    // Apply filters
    if (filters?.gender)
      voices = voices.filter(
        (v) => v.gender?.toLowerCase() === filters.gender!.toLowerCase()
      )
    if (filters?.accent)
      voices = voices.filter((v) =>
        v.accent?.toLowerCase().includes(filters.accent!.toLowerCase())
      )
    if (filters?.language) {
      const targetAccents = LANGUAGE_ACCENT_MAP[filters.language.toLowerCase()] ?? [filters.language.toLowerCase()]
      voices = voices.filter((v) => {
        const accent = v.accent?.toLowerCase() ?? ''
        return targetAccents.some((a) => accent.includes(a))
      })
    }
    if (filters?.useCase) {
      const target = normalizeUseCase(filters.useCase)
      // Expand the chip value into its list of synonyms (fallback to the raw value).
      const synonyms = USE_CASE_SYNONYMS[target] ?? [target]
      voices = voices.filter((v) => {
        if (!v.useCase) return false
        const vUc = normalizeUseCase(v.useCase)
        // Match either direction: voice label contains a synonym, or a
        // synonym contains the label (handles short labels like "news").
        return synonyms.some((syn) => {
          const normSyn = normalizeUseCase(syn)
          return vUc.includes(normSyn) || normSyn.includes(vUc)
        })
      })
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      voices = voices.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q)
      )
    }

    // Sort: French voices first if no language filter
    if (!filters?.language) {
      voices.sort((a, b) => {
        const aFr = a.accent?.toLowerCase() === 'french' ? -1 : 0
        const bFr = b.accent?.toLowerCase() === 'french' ? -1 : 0
        return aFr - bFr
      })
    }

    return voices
  } catch (err) {
    logger.error({ err }, 'ElevenLabs: listPublicVoices failed')
    return []
  }
}

// ── 2. Voix clonées d'un utilisateur ──────────────────────────────────────

export async function listClonedVoices(elevenlabsVoiceIds: string[]): Promise<ClyroVoice[]> {
  if (elevenlabsVoiceIds.length === 0) return []

  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': getApiKey() },
  })
  if (!res.ok) throw new Error(`ElevenLabs /voices error ${res.status}`)

  const data = (await res.json()) as { voices: ElevenLabsVoice[] }
  return (data.voices ?? [])
    .filter((v) => elevenlabsVoiceIds.includes(v.voice_id))
    .map((v) => ({ ...normalizeVoice(v), category: 'cloned' as const }))
}

// ── 3. Filtres disponibles ─────────────────────────────────────────────────

export async function getVoiceFilters(): Promise<{
  genders: string[]
  languages: Array<{ value: string; label: string; flag: string }>
  useCases: string[]
}> {
  // Use the full voice library (account + shared) to build filter options
  const allVoices = await listPublicVoices()

  const availableAccents = new Set(allVoices.map((v) => v.accent?.toLowerCase()).filter(Boolean))
  const languagesMap = new Map<string, { value: string; label: string; flag: string }>()

  for (const [langKey, accents] of Object.entries(LANGUAGE_ACCENT_MAP)) {
    if (accents.some((a) => availableAccents.has(a))) {
      const info = ACCENT_TO_LANGUAGE[accents[0]] ?? { label: langKey, flag: '🌐' }
      languagesMap.set(langKey, { value: langKey, label: info.label, flag: info.flag })
    }
  }

  // Always include French first
  const languagesOrdered = [
    ...(languagesMap.has('français') ? [languagesMap.get('français')!] : [{ value: 'français', label: 'Français', flag: '🇫🇷' }]),
    ...[...languagesMap.values()].filter((l) => l.value !== 'français'),
  ]

  return {
    genders: [...new Set(allVoices.map((v) => v.gender).filter(Boolean))] as string[],
    languages: languagesOrdered,
    useCases: [...new Set(allVoices.map((v) => v.useCase).filter(Boolean))] as string[],
  }
}

// ── 4. TTS — génération voix off ───────────────────────────────────────────

export async function generateVoiceover(
  text: string,
  voiceId: string,
  options?: { stability?: number; similarity_boost?: number }
): Promise<Buffer> {
  return withRetry(async () => {
    const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarity_boost ?? 0.75,
        },
      }),
      signal: AbortSignal.timeout(EL_TTS_TIMEOUT_MS),
    })

    if (!res.ok) {
      // 429/503 → RateLimitError so withRetry honours the server's Retry-After
      // and waits the actual cooldown instead of hammering with 2s/5s/10s/20s.
      if (res.status === 429 || res.status === 503) {
        throw new RateLimitError(
          res.status,
          `TTS rate-limited (${res.status})`,
          parseRetryAfter(res),
        )
      }
      const err = await res.json().catch(() => ({})) as { detail?: { message?: string } }
      throw new Error(`TTS failed ${res.status}: ${err.detail?.message ?? res.statusText}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    logger.info({ voiceId, textLength: text.length, audioBytes: buffer.length }, 'ElevenLabs: TTS done')
    return buffer
  }, `tts:${voiceId}`)
}

// ── 5. TTS par scène ──────────────────────────────────────────────────────

export async function generateVoiceoverScenes(
  scenes: Array<{ id: string; texte_voix: string }>,
  voiceId: string
): Promise<Array<{ sceneId: string; audioBuffer: Buffer }>> {
  const filtered = scenes.filter((s) => s.texte_voix?.trim())
  const allResults: PromiseSettledResult<{ sceneId: string; audioBuffer: Buffer }>[] = []

  for (let i = 0; i < filtered.length; i += EL_TTS_CONCURRENCY) {
    const batch = filtered.slice(i, i + EL_TTS_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (scene) => {
        const audioBuffer = await generateVoiceover(scene.texte_voix, voiceId)
        return { sceneId: scene.id, audioBuffer }
      })
    )
    allResults.push(...batchResults)
  }

  const failCount = allResults.filter((r) => r.status === 'rejected').length
  const failureRatio = allResults.length > 0 ? failCount / allResults.length : 0

  if (failCount > 0) {
    const failedScenes: Array<{ sceneId: string; reason: string }> = []
    allResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        failedScenes.push({
          sceneId: filtered[i]?.id ?? `index-${i}`,
          reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
        })
      }
    })

    logger.warn(
      { sceneCount: scenes.length, failCount, failureRatio, voiceId, failedScenes },
      'ElevenLabs: some scenes failed after retries',
    )

    // Fail loud if too many scenes dropped — otherwise we'd stitch ~30s of audio
    // on a 20-min video by silently filtering out all the rate-limited scenes.
    if (failureRatio > EL_TTS_MAX_FAILURE_RATIO) {
      const ids = failedScenes.map((s) => s.sceneId).join(', ')
      throw new Error(
        `ElevenLabs TTS failed on ${failCount}/${allResults.length} scenes ` +
          `(${(failureRatio * 100).toFixed(0)}%). Failed scene IDs: ${ids}`,
      )
    }
  }

  return allResults
    .filter(
      (r): r is PromiseFulfilledResult<{ sceneId: string; audioBuffer: Buffer }> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
}

// ── 5b. TTS avec timestamps mot par mot (karaoke) ─────────────────────────

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface VoiceoverWithTimestamps {
  audioBuffer: Buffer
  words: WordTimestamp[]
}

export async function generateVoiceoverWithTimestamps(
  text: string,
  voiceId: string,
  options?: { stability?: number; similarity_boost?: number }
): Promise<VoiceoverWithTimestamps> {
  return withRetry(async () => {
    const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarity_boost ?? 0.75,
        },
      }),
      signal: AbortSignal.timeout(EL_TTS_TIMEOUT_MS),
    })

    if (!res.ok) {
      if (res.status === 429 || res.status === 503) {
        throw new RateLimitError(
          res.status,
          `TTS with timestamps rate-limited (${res.status})`,
          parseRetryAfter(res),
        )
      }
      const err = await res.json().catch(() => ({})) as { detail?: { message?: string } }
      throw new Error(`TTS with timestamps failed ${res.status}: ${err.detail?.message ?? res.statusText}`)
    }

    const data = await res.json() as {
      audio_base64: string
      alignment: {
        characters: string[]
        character_start_times_seconds: number[]
        character_end_times_seconds: number[]
      }
    }

    const audioBuffer = Buffer.from(data.audio_base64, 'base64')
    const words = groupCharactersToWords(
      data.alignment.characters,
      data.alignment.character_start_times_seconds,
      data.alignment.character_end_times_seconds
    )

    logger.info({ voiceId, textLength: text.length, wordCount: words.length, audioBytes: audioBuffer.length }, 'ElevenLabs: TTS with timestamps done')
    return { audioBuffer, words }
  }, `tts-timestamps:${voiceId}`)
}

function groupCharactersToWords(
  characters: string[],
  starts: number[],
  ends: number[]
): WordTimestamp[] {
  const words: WordTimestamp[] = []
  let currentWord = ''
  let wordStart = 0

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    if (char === ' ' || char === '\n' || char === '\r') {
      if (currentWord.trim()) {
        words.push({ word: currentWord.trim(), start: wordStart, end: ends[i - 1] ?? ends[i] })
      }
      currentWord = ''
    } else {
      if (!currentWord) wordStart = starts[i]
      currentWord += char
    }
  }
  if (currentWord.trim()) {
    words.push({ word: currentWord.trim(), start: wordStart, end: ends[ends.length - 1] })
  }

  return words
}

export async function generateVoiceoverScenesWithTimestamps(
  scenes: Array<{ id: string; texte_voix: string; voice_id?: string }>,
  voiceId: string,
  persist?: { userId: string; videoId: string }
): Promise<Array<{ sceneId: string; audioBuffer: Buffer; words: WordTimestamp[] }>> {
  const filtered = scenes.filter((s) => s.texte_voix?.trim())

  // Process in batches to stay within ElevenLabs rate limits.
  // Firing all scenes at once (e.g. 60 for a 15-min video) causes most
  // requests to be rate-limited, yielding only ~30s of audio.
  const allResults: PromiseSettledResult<{ sceneId: string; audioBuffer: Buffer; words: WordTimestamp[] }>[] = []

  for (let i = 0; i < filtered.length; i += EL_TTS_CONCURRENCY) {
    const batch = filtered.slice(i, i + EL_TTS_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (scene) => {
        // Use scene-specific voice_id if available (dialogue mode), fallback to voiceId
        const effectiveVoiceId = scene.voice_id ?? voiceId
        // generateVoiceoverWithTimestamps already has retry logic via withRetry
        const result = await generateVoiceoverWithTimestamps(scene.texte_voix, effectiveVoiceId)

        if (persist) {
          const base = `${persist.userId}/${persist.videoId}/audio/scene-${scene.id}`
          await Promise.all([
            supabaseAdmin.storage
              .from('videos')
              .upload(`${base}.mp3`, result.audioBuffer, { contentType: 'application/octet-stream', upsert: true })
              .then(({ error }) => {
                if (error) logger.warn({ error, sceneId: scene.id }, 'ElevenLabs: audio upload failed')
                else logger.info({ sceneId: scene.id }, 'ElevenLabs: audio persisted to storage')
              }),
            supabaseAdmin.storage
              .from('videos')
              .upload(`${base}.json`, Buffer.from(JSON.stringify(result.words)), { contentType: 'application/octet-stream', upsert: true })
              .then(({ error }) => {
                if (error) logger.warn({ error, sceneId: scene.id }, 'ElevenLabs: timestamps upload failed')
              }),
          ])
        }

        return { sceneId: scene.id, ...result }
      })
    )
    allResults.push(...batchResults)
  }

  const failCount = allResults.filter((r) => r.status === 'rejected').length
  const failureRatio = allResults.length > 0 ? failCount / allResults.length : 0

  if (failCount > 0) {
    const failedScenes: Array<{ sceneId: string; reason: string }> = []
    allResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        failedScenes.push({
          sceneId: filtered[i]?.id ?? `index-${i}`,
          reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
        })
      }
    })

    logger.warn(
      { sceneCount: scenes.length, failCount, failureRatio, voiceId, failedScenes },
      'ElevenLabs: some scenes with timestamps failed after retries',
    )

    if (failureRatio > EL_TTS_MAX_FAILURE_RATIO) {
      const ids = failedScenes.map((s) => s.sceneId).join(', ')
      throw new Error(
        `ElevenLabs TTS (timestamps) failed on ${failCount}/${allResults.length} scenes ` +
          `(${(failureRatio * 100).toFixed(0)}%). Failed scene IDs: ${ids}`,
      )
    }
  }

  return allResults
    .filter(
      (r): r is PromiseFulfilledResult<{ sceneId: string; audioBuffer: Buffer; words: WordTimestamp[] }> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
}

// ── 6. Clonage vocal ──────────────────────────────────────────────────────

export async function cloneVoice(
  audioBuffer: Buffer,
  name: string,
  description?: string
): Promise<{ voiceId: string; name: string }> {
  const formData = new FormData()
  formData.append('name', name)
  if (description) formData.append('description', description)
  formData.append('files', new Blob([new Uint8Array(audioBuffer.buffer as ArrayBuffer)], { type: 'audio/mpeg' }), `${name}.mp3`)

  const res = await fetch(`${BASE_URL}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': getApiKey() },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: { message?: string } }
    throw new Error(`Voice cloning failed ${res.status}: ${err.detail?.message ?? res.statusText}`)
  }

  const data = (await res.json()) as { voice_id: string }
  logger.info({ name, voiceId: data.voice_id }, 'ElevenLabs: voice cloned')
  return { voiceId: data.voice_id, name }
}

// ── 7. Suppression voix clonée ────────────────────────────────────────────

export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': getApiKey() },
  })
  if (!res.ok) throw new Error(`Delete voice failed ${res.status}`)
  logger.info({ voiceId }, 'ElevenLabs: voice deleted')
}

// ── Helper ────────────────────────────────────────────────────────────────

function normalizeVoice(v: ElevenLabsVoice): ClyroVoice {
  const accentKey = v.labels.accent?.toLowerCase() ?? ''
  const langInfo = ACCENT_TO_LANGUAGE[accentKey]
  return {
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url,
    // Map all ElevenLabs categories: premade, professional, high_quality → public; cloned/generated → cloned
    category: (v.category === 'cloned' || v.category === 'generated') ? 'cloned' : 'public',
    gender: v.labels.gender,
    accent: v.labels.accent,
    language: langInfo?.label,
    languageFlag: langInfo?.flag,
    age: v.labels.age,
    useCase: v.labels.use_case,
    description: v.labels.description,
  }
}
