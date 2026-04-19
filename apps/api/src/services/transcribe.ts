/**
 * YouTube transcription via fal.ai Whisper.
 *
 * TWO STAGES:
 *   1) Extract audio from the YouTube URL (yt-dlp on the server, see Dockerfile)
 *   2) Send the audio URL to fal.ai Whisper for transcription + segments
 *
 * The extracted audio is uploaded to the `yt-audio` Supabase Storage bucket,
 * fetched by fal.ai via public URL, then deleted in a `finally` block so
 * we don't leak storage on success or failure.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'

const execFileAsync = promisify(execFile)

const YT_AUDIO_BUCKET = 'yt-audio'
// yt-dlp will refuse to download anything longer than this (in seconds).
// Keeps storage and fal.ai cost bounded — also matches the typical Studio
// use case (short-form video scripts).
const MAX_DURATION_SEC = 60 * 30  // 30 minutes
// Hard cap on the binary path; if a host ships yt-dlp elsewhere set
// `YT_DLP_PATH` env var (handy in dev where it's installed via brew).
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp'

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

interface ExtractedAudio {
  audioUrl: string       // public URL fal.ai will fetch
  storagePath: string    // relative path in the bucket, used for cleanup
}

async function extractYouTubeAudio(youtubeUrl: string): Promise<ExtractedAudio> {
  // Single shared scratch dir per call; yt-dlp writes the final mp3 inside.
  const workDir = await mkdtemp(join(tmpdir(), 'yt-audio-'))
  const outputTemplate = join(workDir, 'audio.%(ext)s')

  try {
    // Download best audio + transcode to mp3 @128kbps (small + universally
    // supported by fal.ai Whisper). --no-playlist guards against URLs that
    // also reference a playlist id. --max-filesize is an extra safety net
    // on top of the duration check.
    const args = [
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--max-filesize', '150M',
      '--match-filter', `duration < ${MAX_DURATION_SEC}`,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '-o', outputTemplate,
      youtubeUrl,
    ]

    logger.info({ youtubeUrl, workDir }, 'extractYouTubeAudio: invoking yt-dlp')

    try {
      await execFileAsync(YT_DLP_PATH, args, {
        timeout: 5 * 60 * 1000,    // 5 min wall clock
        maxBuffer: 10 * 1024 * 1024, // 10 MB stdout cap (mostly silent)
      })
    } catch (err: unknown) {
      const e = err as { code?: string; stderr?: string; message?: string }
      if (e.code === 'ENOENT') {
        throw new Error(
          'yt-dlp binary not found on the server. Install it (see Dockerfile) ' +
          'or set YT_DLP_PATH to the full path of the binary.'
        )
      }
      const stderr = e.stderr?.slice(0, 500) ?? e.message ?? 'unknown error'
      throw new Error(`yt-dlp failed: ${stderr}`)
    }

    // yt-dlp picked the extension itself (always mp3 here, but be defensive).
    const files = await readdir(workDir)
    const mp3 = files.find((f) => f.endsWith('.mp3'))
    if (!mp3) {
      throw new Error('yt-dlp did not produce an mp3 file (video may be too long or restricted)')
    }
    const localPath = join(workDir, mp3)
    const buffer = await readFile(localPath)

    if (buffer.length === 0) {
      throw new Error('yt-dlp produced an empty audio file')
    }

    // Upload to a randomized path so URLs are not guessable. The cleanup
    // step below removes the file as soon as fal.ai has finished.
    const storagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.mp3`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(YT_AUDIO_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      })
    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`)
    }

    // Public URL is enough since the bucket is public-read; fal.ai just
    // needs an HTTP GET. Signed URLs would also work but add latency.
    const { data: pub } = supabaseAdmin.storage.from(YT_AUDIO_BUCKET).getPublicUrl(storagePath)
    if (!pub?.publicUrl) {
      throw new Error('Failed to resolve public URL for uploaded audio')
    }

    logger.info(
      { youtubeUrl, storagePath, bytes: buffer.length },
      'extractYouTubeAudio: audio uploaded to Supabase'
    )

    return { audioUrl: pub.publicUrl, storagePath }
  } finally {
    // Clean local scratch dir regardless of success/failure.
    await rm(workDir, { recursive: true, force: true }).catch((err) => {
      logger.warn({ err, workDir }, 'extractYouTubeAudio: failed to clean tmp dir')
    })
  }
}

async function deleteUploadedAudio(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(YT_AUDIO_BUCKET)
    .remove([storagePath])
  if (error) {
    logger.warn({ storagePath, error }, 'deleteUploadedAudio: cleanup failed (non-fatal)')
  }
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
  const { audioUrl, storagePath } = await extractYouTubeAudio(youtubeUrl)
  try {
    return await transcribeAudio(audioUrl)
  } finally {
    // Best-effort cleanup; logged but not thrown so a transcription error
    // bubbles up unchanged to the caller.
    await deleteUploadedAudio(storagePath)
  }
}

export async function transcribeFromUrl(audioUrl: string): Promise<TranscriptResult> {
  return transcribeAudio(audioUrl)
}

// ── URL validation helper ───────────────────────────────────────────────

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url)
}
