'use client'

import { useEffect, useRef, useState } from 'react'
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

/**
 * Hook SSE pour suivre le statut d'une vidéo en cours de génération.
 * Se connecte à GET /api/v1/videos/:id/status et écoute les événements.
 * Ferme la connexion automatiquement quand la vidéo est terminée ou en erreur.
 */
export function useVideoStatus(videoId: string | null): UseVideoStatusReturn {
  const supabase = createBrowserClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  const [state, setState] = useState<VideoStatusState>({
    status: 'pending',
    progress: 0,
    outputUrl: null,
    errorMessage: null,
  })

  useEffect(() => {
    if (!videoId) return

    async function connect() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
      const token = encodeURIComponent(session.access_token)
      const url = `${apiUrl}/api/v1/videos/${videoId}/status?token=${token}`

      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as {
            status: VideoStatus
            progress?: number
            output_url?: string
            error_message?: string
          }

          setState({
            status: data.status,
            progress: data.progress ?? 0,
            outputUrl: data.output_url ?? null,
            errorMessage: data.error_message ?? null,
          })

          if (data.status === 'done' || data.status === 'error') {
            es.close()
          }
        } catch {
          // Ignorer les erreurs de parse
        }
      }

      es.onerror = () => {
        es.close()
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  return {
    ...state,
    isLoading: state.status !== 'done' && state.status !== 'error',
    isDone: state.status === 'done',
    isError: state.status === 'error',
  }
}
