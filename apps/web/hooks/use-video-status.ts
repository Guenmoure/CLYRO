'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { VideoStatus } from '@clyro/shared'

interface VideoStatusState {
  status: VideoStatus
  progress: number
  outputUrl: string | null
  errorMessage: string | null
}

interface UseVideoStatusReturn extends VideoStatusState {
  isLoading: boolean
  isDone: boolean
  isError: boolean
}

const TERMINAL = new Set<VideoStatus>(['done', 'error'])

/**
 * Suivi temps-réel d'une vidéo via Supabase Realtime + polling.
 *
 * Stratégie :
 *  1. Fetch initial  — charge l'état courant dès le montage
 *  2. Supabase Realtime — reçoit chaque UPDATE en temps réel (websocket)
 *  3. Polling 5 s    — filet de sécurité si le websocket est instable
 *
 * L'ancien proxy SSE via Vercel a été retiré : les fonctions serverless
 * Vercel sont coupées après ~60 s, provoquant des 504 sur les vidéos longues.
 */
export function useVideoStatus(videoId: string | null): UseVideoStatusReturn {
  const supabase = createBrowserClient()

  const [state, setState] = useState<VideoStatusState>({
    status: 'pending',
    progress: 0,
    outputUrl: null,
    errorMessage: null,
  })

  const isDoneRef = useRef(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyRow = useCallback((row: {
    status: VideoStatus
    output_url?: string | null
    metadata?: { progress?: number; error_message?: string } | null
  }) => {
    setState({
      status:       row.status,
      progress:     row.metadata?.progress ?? 0,
      outputUrl:    row.output_url ?? null,
      errorMessage: row.metadata?.error_message ?? null,
    })
    if (TERMINAL.has(row.status)) {
      isDoneRef.current = true
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    if (!videoId || isDoneRef.current) return
    const { data } = await supabase
      .from('videos')
      .select('status, output_url, metadata')
      .eq('id', videoId)
      .single()
    if (data) applyRow(data as Parameters<typeof applyRow>[0])
  }, [videoId, supabase, applyRow])

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return
    isDoneRef.current = false
    fetchStatus()
  }, [videoId, fetchStatus])

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return

    const channel = supabase
      .channel(`video-status-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          applyRow(payload.new as Parameters<typeof applyRow>[0])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // ── Polling fallback (5 s) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return
    pollTimer.current = setInterval(fetchStatus, 5_000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [videoId, fetchStatus])

  return {
    ...state,
    isLoading: !TERMINAL.has(state.status),
    isDone:    state.status === 'done',
    isError:   state.status === 'error',
  }
}
