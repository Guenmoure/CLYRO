'use client'

import { useState } from 'react'
import { deleteVideo } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

export interface VideoItem {
  id: string
  title: string | null
  module: string | null
  style: string | null
  status: string
  output_url: string | null
  created_at: string
}

interface VideoCardProps {
  video: VideoItem
  onDeleted: (id: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  done: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  processing: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  storyboard: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  visuals: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20',
  audio: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20',
  assembly: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  processing: 'En traitement',
  storyboard: 'Storyboard',
  visuals: 'Génération visuels',
  audio: 'Voix off',
  assembly: 'Assemblage',
  done: 'Terminé',
  error: 'Erreur',
}

const MODULE_ICONS: Record<string, string> = {
  faceless: '🎬',
  motion: '✨',
}

export function VideoCard({ video, onDeleted }: VideoCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const statusStyle = STATUS_STYLES[video.status] ?? STATUS_STYLES['processing']
  const statusLabel = STATUS_LABELS[video.status] ?? video.status
  const icon = MODULE_ICONS[video.module ?? ''] ?? '▶'

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVideo(video.id)
      toast.success('Vidéo supprimée')
      onDeleted(video.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-primary/30 transition-colors">
      <div className="flex items-center gap-4">
        {/* Thumbnail / icon */}
        <div className="w-14 h-14 bg-brand-bg rounded-lg flex items-center justify-center shrink-0 text-2xl">
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-brand-text truncate">
            {video.title ?? 'Vidéo sans titre'}
          </p>
          <p className="font-mono text-xs text-brand-muted mt-0.5">
            {video.module ?? '—'} · {video.style ?? '—'} · {formatDateTime(video.created_at)}
          </p>
        </div>

        {/* Status badge */}
        <span className={`font-mono text-xs px-3 py-1 rounded-full border shrink-0 ${statusStyle}`}>
          {statusLabel}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {video.status === 'done' && video.output_url && (
            <a
              href={video.output_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-brand-primary hover:underline px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-lg transition-colors hover:bg-brand-primary/20"
            >
              Télécharger
            </a>
          )}

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="font-mono text-xs text-red-500 hover:underline px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? '...' : 'Confirmer'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="font-mono text-xs text-brand-muted px-3 py-1.5 bg-brand-bg border border-brand-border rounded-lg hover:bg-brand-surface transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
