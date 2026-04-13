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
  done: 'bg-success/10 text-success border-success/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  processing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  storyboard: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  visuals: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  audio: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  assembly: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
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
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/download-video?id=${video.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${video.title ?? 'video'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erreur lors du téléchargement')
    } finally {
      setDownloading(false)
    }
  }

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
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 hover:border-blue-500/30 transition-colors">
      <div className="flex items-center gap-4">
        {/* Thumbnail / icon */}
        <div className="w-14 h-14 bg-navy-900 rounded-lg flex items-center justify-center shrink-0 text-2xl">
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground truncate">
            {video.title ?? 'Vidéo sans titre'}
          </p>
          <p className="font-mono text-xs text-[--text-muted] mt-0.5">
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
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="font-mono text-xs text-blue-500 hover:underline px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg transition-colors hover:bg-blue-500/20 disabled:opacity-50"
            >
              {downloading ? '...' : 'Télécharger'}
            </button>
          )}

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="font-mono text-xs text-red-500 hover:underline px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? '...' : 'Confirmer'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="font-mono text-xs text-[--text-muted] px-3 py-1.5 bg-navy-900 border border-navy-700 rounded-lg hover:bg-navy-800 transition-colors"
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
