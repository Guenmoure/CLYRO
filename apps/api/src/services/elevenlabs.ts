import { logger } from '../lib/logger'

const BASE_URL = 'https://api.elevenlabs.io/v1'
const DEFAULT_MODEL = 'eleven_multilingual_v2'

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
  category: 'premade' | 'cloned' | 'generated'
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
  age?: string
  useCase?: string
  description?: string
}

export interface VoiceFilters {
  gender?: string
  accent?: string
  useCase?: string
  search?: string
}

// ── 1. Voix publiques (bibliothèque premade) ───────────────────────────────

export async function listPublicVoices(filters?: VoiceFilters): Promise<ClyroVoice[]> {
  try {
    const res = await fetch(`${BASE_URL}/voices`, {
      headers: { 'xi-api-key': getApiKey() },
    })

    if (!res.ok) throw new Error(`ElevenLabs /voices error ${res.status}`)

    const data = (await res.json()) as { voices: ElevenLabsVoice[] }
    let voices = (data.voices ?? []).filter((v) => v.category === 'premade')

    if (filters?.gender)
      voices = voices.filter(
        (v) => v.labels.gender?.toLowerCase() === filters.gender!.toLowerCase()
      )
    if (filters?.accent)
      voices = voices.filter((v) =>
        v.labels.accent?.toLowerCase().includes(filters.accent!.toLowerCase())
      )
    if (filters?.useCase)
      voices = voices.filter(
        (v) => v.labels.use_case?.toLowerCase() === filters.useCase!.toLowerCase()
      )
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      voices = voices.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.labels.description?.toLowerCase().includes(q)
      )
    }

    return voices.map(normalizeVoice)
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
  accents: string[]
  useCases: string[]
}> {
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': getApiKey() },
  })
  if (!res.ok) throw new Error(`ElevenLabs /voices error ${res.status}`)

  const data = (await res.json()) as { voices: ElevenLabsVoice[] }
  const voices = (data.voices ?? []).filter((v) => v.category === 'premade')

  return {
    genders: [...new Set(voices.map((v) => v.labels.gender).filter(Boolean))] as string[],
    accents: [...new Set(voices.map((v) => v.labels.accent).filter(Boolean))] as string[],
    useCases: [...new Set(voices.map((v) => v.labels.use_case).filter(Boolean))] as string[],
  }
}

// ── 4. TTS — génération voix off ───────────────────────────────────────────

export async function generateVoiceover(
  text: string,
  voiceId: string,
  options?: { stability?: number; similarity_boost?: number }
): Promise<Buffer> {
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
        const audioBuffer = await generateVoiceover(scene.texte_voix, voiceId)
        return { sceneId: scene.id, audioBuffer }
      })
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<{ sceneId: string; audioBuffer: Buffer }> =>
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
  formData.append('files', new Blob([audioBuffer], { type: 'audio/mpeg' }), `${name}.mp3`)

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
  return {
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url,
    category: v.category === 'premade' ? 'public' : 'cloned',
    gender: v.labels.gender,
    accent: v.labels.accent,
    age: v.labels.age,
    useCase: v.labels.use_case,
    description: v.labels.description,
  }
}
