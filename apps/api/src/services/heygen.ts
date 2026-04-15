/**
 * HeyGen v2 API wrapper for F5 Studio.
 * Docs: https://docs.heygen.com/
 */

import { logger } from '../lib/logger'

const HEYGEN_BASE = 'https://api.heygen.com'
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY ?? ''

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: 'male' | 'female' | 'neutral'
  preview_image_url: string
  preview_video_url?: string
  premium?: boolean
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
  voiceId: string        // ElevenLabs voice_id
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

  const body = {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: params.avatarId,
        avatar_style: 'normal',
      },
      voice: {
        type: 'text',
        input_text: params.script,
        voice_id: params.voiceId,
      },
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

// ── List avatars ────────────────────────────────────────────────────────

export async function listAvatars(): Promise<HeyGenAvatar[]> {
  if (!HEYGEN_API_KEY) return []  // graceful fallback if not configured

  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
    headers: { 'X-Api-Key': HEYGEN_API_KEY },
  })
  const data = await res.json() as { data: { avatars: HeyGenAvatar[] }; message?: string }
  if (!res.ok) {
    logger.warn({ status: res.status }, 'HeyGen listAvatars failed')
    return []
  }
  return data.data.avatars ?? []
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
