'use client'

import { useState } from 'react'
import { deleteVideo } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'

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

// Canonical 4-value status enum: draft | generating | done | error.
// Legacy values are mapped to their canonical bucket below so any row
// still carrying an old status (pre-migration) renders sensibly.
const STATUS_STYLES: Record<string, string> = {
  draft:      'bg-amber-500/10 text-amber-600 border-amber-500/20',
  generating: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  done:       'bg-success/10 text-success border-success/20',
  error:      'bg-red-500/10 text-red-500 border-red-500/20',
  // Legacy fallbacks — same color as `generating`.
  pending:    'bg-violet-500/10 text-violet-500 border-violet-500/20',
  processing: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  storyboard: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  visuals:    'bg-violet-500/10 text-violet-500 border-violet-500/20',
  audio:      'bg-violet-500/10 text-violet-500 border-violet-500/20',
  assembly:   'bg-violet-500/10 text-violet-500 border-violet-500/20',
  completed:  'bg-success/10 text-success border-success/20',
}

// Maps raw status to a translation key.
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft:      'vc_draft',
  generating: 'vc_generating',
  done:       'vc_done',
  error:      'vc_error',
  pending:    'vc_generating',
  processing: 'vc_generating',
  storyboard: 'vc_generating',
  visuals:    'vc_generating',
  audio:      'vc_generating',
  assembly:   'vc_generating',
  completed:  'vc_done',
}

const MODULE_ICONS: Record<string, string> = {
  faceless: '🎬',
  motion: '✨',
}

export function VideoCard({ video, onDeleted }: VideoCardProps) {
  const { t } = useLanguage()
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
      toast.error(t('vc_downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  const statusStyle = STATUS_STYLES[video.status] ?? STATUS_STYLES['processing']
  const statusLabelKey = STATUS_LABEL_KEYS[video.status]
  const statusLabel = statusLabelKey ? t(statusLabelKey) : video.status
  const icon = MODULE_ICONS[video.module ?? ''] ?? '▶'

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVideo(video.id)
      toast.success(t('vc_deleted'))
      onDeleted(video.id)
    } catch {
      toast.error(t('vc_deleteError'))
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="bg-muted border border-border rounded-xl p-4 hover:border-border transition-colors">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Thumbnail / icon */}
        <div className="w-14 h-14 bg-card rounded-lg flex items-center justify-center shrink-0 text-2xl">
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground truncate">
            {video.title ?? t('vc_untitled')}
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
              className="font-mono text-xs text-primary hover:underline px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-lg transition-colors hover:bg-brand/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {downloading ? '...' : t('vc_download')}
            </button>
          )}

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="font-mono text-xs text-red-500 hover:underline px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t('vc_delete')}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {deleting ? '...' : t('confirm')}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="font-mono text-xs text-[--text-muted] px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {t('cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
