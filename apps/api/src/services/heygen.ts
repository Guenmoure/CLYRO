/**
 * HeyGen v2 API wrapper for F5 Studio.
 * Docs: https://docs.heygen.com/
 */

import { logger } from '../lib/logger'

const HEYGEN_BASE = 'https://api.heygen.com'
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY ?? ''

/** Raw avatar object from HeyGen /v2/avatars */
export interface HeyGenAvatarRaw {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  premium?: boolean
  avatar_type?: string        // e.g. "public", "private", "custom"
  group_id?: string
  is_favorite?: boolean
  looks?: Array<{
    look_id: string
    name: string
    preview_image_url: string
    preview_video_url?: string
  }>
  tags?: string[]             // e.g. ["professional", "lifestyle", "ugc"]
  [key: string]: unknown      // capture any extra fields from the API
}

/** Normalized avatar for CLYRO frontend */
export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  premium?: boolean
  avatar_type?: string
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

export interface HeyGenVideoStatus {
  status: 'processing' | 'pending' | 'completed' | 'failed'
  video_url?: string
  thumbnail_url?: string
  duration?: number
  error?: { code: string; message: string }
}

// ── Generate an avatar scene ────────────────────────────────────────────

interface GenerateAvatarSceneParams {
  avatarId: string
  /** HeyGen native TTS voice ID. Ignored when audioUrl is provided. */
  voiceId?: string
  /** Pre-generated audio URL (ElevenLabs or any CDN). When set, HeyGen uses
   *  type:'audio' which accepts any valid audio URL — no HeyGen voice needed. */
  audioUrl?: string
  script: string
  background: { type: 'color'; value: string } | { type: 'image'; url: string }
  callbackId: string     // `${projectId}_scene_${index}`
  format: '16_9' | '9_16'
}

export async function generateAvatarScene(params: GenerateAvatarSceneParams): Promise<{ heygenVideoId: string }> {
  if (!HEYGEN_API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured')
  }

  const dimension = params.format === '16_9'
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 }

  // Prefer pre-generated audio (ElevenLabs) over HeyGen native TTS.
  // HeyGen type:'text' expects a HeyGen-native voice_id — passing an
  // ElevenLabs ID there causes HeyGen to fail silently after queuing.
  const voice = params.audioUrl
    ? { type: 'audio', audio_url: params.audioUrl }
    : { type: 'text', input_text: params.script, voice_id: params.voiceId ?? '' }

  const body = {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: params.avatarId,
        avatar_style: 'normal',
      },
      voice,
      background: params.background,
    }],
    dimension,
    callback_id: params.callbackId,
  }

  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as { data?: { video_id: string }; message?: string }
  if (!res.ok || !data.data) {
    logger.error({ status: res.status, data }, 'HeyGen generate error')
    throw new Error(data.message ?? `HeyGen ${res.status}`)
  }
  return { heygenVideoId: data.data.video_id }
}

// ── Check video status ──────────────────────────────────────────────────

export async function getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')

  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': HEYGEN_API_KEY },
  })
  const data = await res.json() as { data: HeyGenVideoStatus; message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? `HeyGen status ${res.status}`)
  }
  return data.data
}

// ── Category inference from avatar tags / type / name ──────────────────

const PROFESSIONAL_KEYWORDS = ['professional', 'business', 'corporate', 'formal', 'office']
const LIFESTYLE_KEYWORDS = ['lifestyle', 'casual', 'everyday', 'friendly']
const UGC_KEYWORDS = ['ugc', 'creator', 'influencer', 'selfie', 'content']

function inferCategory(raw: HeyGenAvatarRaw): HeyGenAvatar['category'] {
  // 1. Check tags first
  const tags = (raw.tags ?? []).map((t) => t.toLowerCase())
  if (tags.some((t) => PROFESSIONAL_KEYWORDS.includes(t))) return 'professional'
  if (tags.some((t) => LIFESTYLE_KEYWORDS.includes(t))) return 'lifestyle'
  if (tags.some((t) => UGC_KEYWORDS.includes(t))) return 'ugc'

  // 2. Check avatar_type from HeyGen
  const type = (raw.avatar_type ?? '').toLowerCase()
  if (type === 'private' || type === 'custom') return 'community'

  // 3. Fallback: if it has multiple looks → likely professional
  if ((raw.looks ?? []).length >= 5) return 'professional'

  return 'other'
}

function normalizeAvatar(raw: HeyGenAvatarRaw): HeyGenAvatar {
  const looks = (raw.looks ?? []).map((l) => ({
    look_id: l.look_id ?? '',
    name: l.name ?? '',
    preview_image_url: l.preview_image_url ?? '',
    preview_video_url: l.preview_video_url,
  }))

  return {
    avatar_id: raw.avatar_id,
    avatar_name: raw.avatar_name,
    gender: raw.gender ?? 'neutral',
    preview_image_url: raw.preview_image_url,
    preview_video_url: raw.preview_video_url,
    premium: raw.premium,
    avatar_type: raw.avatar_type,
    group_id: raw.group_id,
    looks_count: looks.length,
    looks,
    tags: raw.tags ?? [],
    category: inferCategory(raw),
  }
}

// ── List avatars ────────────────────────────────────────────────────────

export async function listAvatars(): Promise<HeyGenAvatar[]> {
  if (!HEYGEN_API_KEY) return []  // graceful fallback if not configured

  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
    headers: { 'X-Api-Key': HEYGEN_API_KEY },
  })
  const data = await res.json() as { data: { avatars: HeyGenAvatarRaw[] }; message?: string }
  if (!res.ok) {
    logger.warn({ status: res.status, body: data }, 'HeyGen listAvatars failed')
    return []
  }
  const raw = data.data.avatars ?? []

  // Log a sample avatar to see full API shape (debug, remove later)
  if (raw.length > 0) {
    logger.info({ sampleKeys: Object.keys(raw[0]), sample: JSON.stringify(raw[0]).slice(0, 500) }, 'HeyGen avatar sample')
  }

  const avatars = raw.map(normalizeAvatar)
  const cats = avatars.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc }, {} as Record<string, number>)
  logger.info({ count: avatars.length, categories: cats }, 'HeyGen avatars loaded')
  return avatars
}

// ── Instant Avatar (Digital Twin) ───────────────────────────────────────

interface CreateInstantAvatarParams {
  videoUrl: string     // User-uploaded video URL (≥2 min)
  name: string
  callbackId: string
}

export async function createInstantAvatar(params: CreateInstantAvatarParams): Promise<{ avatarId: string }> {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')

  const res = await fetch(`${HEYGEN_BASE}/v2/photo_avatar/instant_avatar/task`, {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: params.videoUrl,
      name: params.name,
      callback_id: params.callbackId,
    }),
  })
  const data = await res.json() as { data?: { avatar_id: string }; message?: string }
  if (!res.ok || !data.data) {
    throw new Error(data.message ?? `HeyGen avatar ${res.status}`)
  }
  return { avatarId: data.data.avatar_id }
}

// ── Webhook signature verification ──────────────────────────────────────

import { createHmac, timingSafeEqual } from 'crypto'

export function verifyHeyGenSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.HEYGEN_WEBHOOK_SECRET
  if (!secret) {
    logger.warn('HEYGEN_WEBHOOK_SECRET not set — skipping signature check')
    return true  // dev fallback — be loud about it
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
