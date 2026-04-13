'use client'

import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import type { VideoProject } from './ProjectCard'

interface RealtimeProjectsProps {
  userId: string
  onUpdate: (id: string, patch: Partial<VideoProject>) => void
}

export function RealtimeProjects({ userId, onUpdate }: RealtimeProjectsProps) {
  const supabase    = createBrowserClient()
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (channelRef.current) return

    const channel = supabase
      .channel(`dashboard-projects-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const updated = payload.new as unknown as VideoProject & { id: string }
          const prev    = payload.old as unknown as Partial<VideoProject>

          if (updated.status === 'done' && prev.status !== 'done') {
            onUpdate(updated.id, {
              status:       'done',
              output_url:   updated.output_url,
              thumbnail_url: updated.thumbnail_url,
            })
            toast.success(`✓ "${updated.title ?? 'Vidéo'}" est prête`)
          }

          if (updated.status === 'error' && prev.status !== 'error') {
            onUpdate(updated.id, { status: 'error' })
            toast.error(`Erreur sur "${updated.title ?? 'Vidéo'}". Vérifier les détails.`)
          }

          if (updated.status !== 'done' && updated.status !== 'error') {
            onUpdate(updated.id, { status: updated.status })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, userId, onUpdate])

  return null
}
