import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'

const BASE_URL = 'https://api.elevenlabs.io/v1'

const EL_MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= EL_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < EL_MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt - 1) // 500ms, 1s, 2s
        logger.warn({ attempt, label, delay, error: err instanceof Error ? err.message : String(err) }, 'ElevenLabs: retrying')
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
// eleven_turbo_v2_5 : 3× plus rapide que multilingual_v2, latence ~2s/scène vs ~6s
// Garde la qualité voix off pour de courtes durées (30-60s max)
const DEFAULT_MODEL = 'eleven_turbo_v2_5'

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
    })

    if (!res.ok) {
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
  const results = await Promise.allSettled(
    scenes
      .filter((s) => s.texte_voix?.trim())
      .map(async (scene) => {
        // generateVoiceover already has retry logic via withRetry
        const audioBuffer = await generateVoiceover(scene.texte_voix, voiceId)
        return { sceneId: scene.id, audioBuffer }
      })
  )

  const failCount = results.filter((r) => r.status === 'rejected').length
  if (failCount > 0) {
    logger.warn({ sceneCount: scenes.length, failCount, voiceId }, 'ElevenLabs: some scenes failed after retries')
  }

  return results
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
    })

    if (!res.ok) {
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
  const results = await Promise.allSettled(
    scenes
      .filter((s) => s.texte_voix?.trim())
      .map(async (scene) => {
        // Use scene-specific voice_id if available (dialogue mode), fallback to voiceId
        const effectiveVoiceId = scene.voice_id ?? voiceId
        // generateVoiceoverWithTimestamps already has retry logic via withRetry
        const result = await generateVoiceoverWithTimestamps(scene.texte_voix, effectiveVoiceId)

        if (persist) {
          const base = `${persist.userId}/${persist.videoId}/audio/scene-${scene.id}`
          await Promise.all([
            supabaseAdmin.storage
              .from('videos')
              .upload(`${base}.mp3`, result.audioBuffer, { contentType: 'audio/mpeg', upsert: true })
              .then(({ error }) => {
                if (error) logger.warn({ error, sceneId: scene.id }, 'ElevenLabs: audio upload failed')
                else logger.info({ sceneId: scene.id }, 'ElevenLabs: audio persisted to storage')
              }),
            supabaseAdmin.storage
              .from('videos')
              .upload(`${base}.json`, Buffer.from(JSON.stringify(result.words)), { contentType: 'application/json', upsert: true })
              .then(({ error }) => {
                if (error) logger.warn({ error, sceneId: scene.id }, 'ElevenLabs: timestamps upload failed')
              }),
          ])
        }

        return { sceneId: scene.id, ...result }
      })
  )

  const failCount = results.filter((r) => r.status === 'rejected').length
  if (failCount > 0) {
    logger.warn({ sceneCount: scenes.length, failCount, voiceId }, 'ElevenLabs: some scenes with timestamps failed after retries')
  }

  return results
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
