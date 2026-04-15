/**
 * YouTube transcription via fal.ai Whisper.
 *
 * TWO STAGES:
 *   1) Extract audio from the YouTube URL (yt-dlp on the Render server)
 *   2) Send the audio URL to fal.ai Whisper for transcription + segments
 *
 * STATUS: yt-dlp is not installed in the current Docker image — the
 * `extractYouTubeAudio` function is a stub that throws. Install yt-dlp
 * via `apk add yt-dlp` in apps/api/Dockerfile (production stage) to
 * enable it, or swap for a hosted service (youtube-dl-api, RapidAPI).
 */

import { logger } from '../lib/logger'

export interface TranscriptSegment {
  start: number  // seconds
  end: number
  text: string
}

export interface TranscriptResult {
  transcript: string
  language: string
  segments: TranscriptSegment[]
  duration: number
}

// ── Stage 1: Extract audio from YouTube ─────────────────────────────────
// TODO(F5): wire yt-dlp binary or external service
async function extractYouTubeAudio(youtubeUrl: string): Promise<{ audioUrl: string }> {
  logger.warn({ youtubeUrl }, 'extractYouTubeAudio called — yt-dlp not yet installed')
  throw new Error(
    'YouTube audio extraction is not yet available. Install yt-dlp on the server ' +
    'or paste the script directly. Tracked in F5 backlog.'
  )
}

// ── Stage 2: Transcribe via fal.ai Whisper ──────────────────────────────

interface FalWhisperResponse {
  text: string
  detected_language?: string
  chunks?: Array<{ timestamp: [number, number]; text: string }>
}

async function transcribeAudio(audioUrl: string): Promise<TranscriptResult> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  const res = await fetch('https://fal.run/fal-ai/whisper', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      task: 'transcribe',
      language: 'auto',
      chunk_level: 'segment',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`fal.ai Whisper ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json() as FalWhisperResponse

  const segments: TranscriptSegment[] = (data.chunks ?? []).map((c) => ({
    start: c.timestamp[0],
    end:   c.timestamp[1],
    text:  c.text.trim(),
  }))

  return {
    transcript: data.text,
    language:   data.detected_language ?? 'unknown',
    segments,
    duration:   segments.length > 0 ? segments[segments.length - 1]!.end : 0,
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export async function transcribeYouTube(youtubeUrl: string): Promise<TranscriptResult> {
  const { audioUrl } = await extractYouTubeAudio(youtubeUrl)
  return transcribeAudio(audioUrl)
}

export async function transcribeFromUrl(audioUrl: string): Promise<TranscriptResult> {
  return transcribeAudio(audioUrl)
}

// ── URL validation helper ───────────────────────────────────────────────

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url)
}
