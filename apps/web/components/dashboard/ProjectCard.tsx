'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Video, Sparkles, Palette, MoreVertical,
  Copy, Download, FilePlus, Users, Pencil,
  FolderInput, Trash2, Gem, Camera, RotateCcw, Loader2,
  X, Play, ExternalLink, Clapperboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import { MoveToFolderModal } from '@/components/dashboard/MoveToFolderModal'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VideoProject {
  id: string
  title: string | null
  module: string | null
  style: string | null
  status: string
  output_url: string | null
  thumbnail_url?: string | null
  created_at: string
  duration_seconds?: number | null
  created_by?: string | null
  /** Optional folder grouping. NULL/undefined = unfiled. */
  folder_id?: string | null
}

interface ProjectCardProps {
  project: VideoProject
  onDeleted?: (id: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ElementType> = {
  faceless: Video,
  motion:   Sparkles,
  brand:    Palette,
  studio:   Clapperboard,
}

const MODULE_ICON_COLORS: Record<string, string> = {
  faceless: 'text-blue-400',
  motion:   'text-purple-400',
  brand:    'text-amber-400',
  studio:   'text-emerald-400',
}

const MODULE_LABELS: Record<string, string> = {
  faceless: 'Faceless Video',
  motion:   'Motion Design',
  brand:    'Brand Kit',
  studio:   'AI Studio',
}

/** Gradient placeholder shown when a project has no thumbnail yet */
const MODULE_GRADIENTS: Record<string, string> = {
  faceless: 'from-blue-900/60 via-blue-800/30 to-indigo-900/40',
  motion:   'from-purple-900/60 via-violet-800/30 to-indigo-900/40',
  brand:    'from-amber-900/50 via-orange-800/30 to-slate-900/40',
  studio:   'from-rose-900/50 via-pink-800/30 to-slate-900/40',
}

function formatRelativeDate(dateStr: string, t: (k: string) => string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins  = Math.floor(diff / 60_000)
  if (days > 30)  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  if (days > 1)   return t('time_daysAgo').replace('{n}', String(days))
  if (days === 1) return t('time_yesterday')
  if (hours > 0)  return t('time_hAgo').replace('{n}', String(hours))
  if (mins > 0)   return t('time_minAgo').replace('{n}', String(mins))
  return t('time_justNow')
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}min`
  }
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

// ── Video Preview Modal ─────────────────────────────────────────────────────────

function VideoPreviewModal({
  title,
  videoUrl,
  onClose,
}: {
  title: string | null
  videoUrl: string
  onClose: () => void
}) {
  const { t } = useLanguage()
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-card rounded-2xl overflow-hidden shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-display text-sm font-semibold text-foreground truncate pr-4">
            {title ?? t('pc_videoPreview')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={videoUrl}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground hover:bg-muted transition-colors"
            >
              <Download size={12} /> {t('pc_download')}
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('pc_closePreview')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full max-h-[70vh] object-contain"
          />
        </div>
      </div>
    </div>
  )
}

// ── Context menu ───────────────────────────────────────────────────────────────

function ContextMenu({
  project,
  onClose,
  onDelete,
  onRename,
  onEditAsNew,
  onPreview,
  onMove,
}: {
  project: VideoProject
  onClose: () => void
  onDelete: () => void
  onRename: () => void
  onEditAsNew: () => void
  onPreview: () => void
  onMove: () => void
}) {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function copyId() {
    navigator.clipboard.writeText(project.id).catch(() => null)
    toast.success(t('pc_idCopied'))
    onClose()
  }

  const item = 'flex items-center gap-3 px-4 py-2.5 text-sm font-body text-foreground hover:bg-muted transition-colors w-full text-left'
  const itemDisabled = 'flex items-center gap-3 px-4 py-2.5 text-sm font-body text-[--text-muted] w-full text-left cursor-not-allowed'
  const isBrand = project.module === 'brand'

  return (
    <div
      ref={ref}
      className="absolute top-9 right-0 w-52 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
        {MODULE_LABELS[project.module ?? ''] ?? t('pc_project')}
      </p>

      {/* Actions */}
      <div className="py-1">
        <button type="button" onClick={copyId} className={item}>
          <Copy size={14} /> {t('pc_copyId')}
        </button>

        {/* Preview / View Kit */}
        {isBrand ? (
          project.output_url ? (
            <a href={project.output_url} download onClick={onClose} className={item}>
              <Download size={14} /> {t('pc_downloadKit')}
            </a>
          ) : (
            <button type="button" disabled className={cn(item, 'opacity-40 cursor-not-allowed')}>
              <Download size={14} /> {t('pc_downloadKit')}
            </button>
          )
        ) : project.output_url ? (
          <button type="button" onClick={() => { onClose(); onPreview() }} className={item}>
            <Play size={14} /> {t('pc_preview')}
          </button>
        ) : (
          <button type="button" disabled className={cn(item, 'opacity-40 cursor-not-allowed')}>
            <Play size={14} /> {t('pc_preview')}
          </button>
        )}

        {!isBrand && project.output_url ? (
          <a href={project.output_url} download onClick={onClose} className={item}>
            <Download size={14} /> {t('pc_download')}
</a>
        ) : !isBrand ? (
          <button type="button" disabled className={cn(item, 'opacity-40 cursor-not-allowed')}>
            <Download size={14} /> {t('pc_download')}
</button>
        ) : null}

        <button
          type="button"
          onClick={() => { onClose(); onEditAsNew() }}
          className={item}
        >
          <FilePlus size={14} /> {t('pc_editAsNew')}
        </button>
        <button type="button" disabled className={itemDisabled} aria-disabled="true">
          <Users size={14} />
          <span>{t('pc_collaborate')}</span>
          <Gem size={12} className="text-warning ml-auto" />
        </button>
        <button
          type="button"
          onClick={() => { onClose(); onRename() }}
          className={item}
        >
          <Pencil size={14} /> {t('pc_rename')}
        </button>
        <button
          type="button"
          onClick={() => { onClose(); onMove() }}
          className={item}
        >
          <FolderInput size={14} /> {t('pc_move')}
        </button>
      </div>

      {/* Divider + Trash */}
      <div className="border-t border-border" />
      <div className="py-1">
        <button
          type="button"
          onClick={() => { onClose(); onDelete() }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error hover:bg-error/10 transition-colors w-full text-left"
        >
          <Trash2 size={14} /> {t('pc_delete')}
        </button>
      </div>
    </div>
  )
}

// ── ProjectCard ────────────────────────────────────────────────────────────────

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [deleted,        setDeleted]        = useState(false)
  const [reverting,      setReverting]      = useState(false)
  const [localTitle,     setLocalTitle]     = useState<string | null>(project.title)
  const [renaming,       setRenaming]       = useState(false)
  const [duplicating,    setDuplicating]    = useState(false)
  const [previewOpen,    setPreviewOpen]    = useState(false)
  const [moveOpen,       setMoveOpen]       = useState(false)
  const [localFolderId,  setLocalFolderId]  = useState<string | null>(project.folder_id ?? null)

  const isProcessing = ['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly', 'animation'].includes(project.status)
  const isDone       = project.status === 'done'
  const isError      = project.status === 'error'
  const isBrand      = project.module === 'brand'

  async function handleRevertToDraft() {
    if (reverting) return
    setReverting(true)
    try {
      const res = await fetch(`/api/videos/${project.id}/revert-draft`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { module } = await res.json() as { id: string; module: string }
      router.push(`/${module}/new?draft=${project.id}`)
    } catch {
      setReverting(false)
    }
  }

  async function handleRename() {
    if (renaming) return
    const current = localTitle ?? t('pc_untitled')
    const next = typeof window === 'undefined' ? null : window.prompt(t('pc_renameProject'), current)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === current) return

    setRenaming(true)
    try {
      const res = await fetch(`/api/videos/${project.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json() as { title: string | null }
      setLocalTitle(updated.title ?? trimmed)
      router.refresh()
    } catch {
      // silent — keep previous title
    } finally {
      setRenaming(false)
    }
  }

  async function handleEditAsNew() {
    if (duplicating) return
    setDuplicating(true)
    toast.info(t('pc_duplicating'))
    try {
      const res = await fetch(`/api/videos/${project.id}/duplicate`, { method: 'POST' })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error('[EditAsNew] duplicate failed', res.status, detail)
        throw new Error(`HTTP ${res.status}`)
      }
      const { id: newId, module, target } = await res.json() as {
        id: string; module: string; target: 'hub' | 'new'
      }
      router.push(`/${module}/${target}?draft=${newId}`)
    } catch (err) {
      console.error('[EditAsNew]', err)
      toast.error(t('pc_duplicateError'))
      setDuplicating(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/videos/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleted(true)
      onDeleted?.(project.id)
      toast.success(t('pc_projectDeleted'))
    } catch {
      setDeleting(false)
      toast.error(t('pc_deleteError'))
    }
  }

  const ModuleIcon     = MODULE_ICONS[project.module ?? ''] ?? Video
  const iconColor      = MODULE_ICON_COLORS[project.module ?? ''] ?? 'text-[--text-muted]'
  const moduleGradient = MODULE_GRADIENTS[project.module ?? ''] ?? 'from-slate-900/50 via-slate-800/30 to-slate-900/40'
  const moduleLabel    = MODULE_LABELS[project.module ?? ''] ?? t('pc_project')

  // For brand kit done state: link to brand hub to view results
  const brandHubHref = `/brand/hub?draft=${project.id}`

  function handleThumbnailClick() {
    if (isProcessing || isError) return
    if (isBrand) {
      router.push(brandHubHref)
      return
    }
    if (project.output_url) setPreviewOpen(true)
  }

  if (deleted) return null

  return (
    <>
      <div className={cn(
        'group relative rounded-2xl overflow-hidden',
        'bg-card border border-border/60',
        'hover:border-border hover:shadow-card-hover',
        'transition-all duration-200',
        deleting && 'opacity-50 pointer-events-none',
      )}>

        {/* Thumbnail */}
        <div
          className={cn(
            'relative aspect-video overflow-hidden bg-card',
            (isDone || isBrand) && !isProcessing && 'cursor-pointer',
          )}
          onClick={handleThumbnailClick}
        >
          {/* Gradient placeholder */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br flex items-center justify-center',
            moduleGradient,
          )}>
            <ModuleIcon size={32} className={cn(iconColor, 'opacity-20')} />
          </div>

          {/* Real thumbnail */}
          {project.thumbnail_url && (
            <Image
              src={project.thumbnail_url}
              alt={project.title ?? t('pc_project')}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}

          {/* Hover overlay */}
          {!isProcessing && !isError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
              <div className={cn(
                'w-11 h-11 rounded-full bg-white/90 shadow-lg',
                'flex items-center justify-center',
                'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100',
                'transition-all duration-200',
              )}>
                {isBrand
                  ? <ExternalLink className="w-4 h-4 text-gray-900" />
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-900 ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                }
              </div>
            </div>
          )}

          {/* Status badge — top-left */}
          <div className="absolute top-2 left-2">
            {isProcessing && <Badge variant="info" dot>{t('pc_processing')}</Badge>}
            {isError && <Badge variant="error">{t('pc_error')}</Badge>}
            {isDone && isBrand && <Badge variant="success">{t('pc_done')}</Badge>}
          </div>

          {/* Duration chip — bottom-right */}
          {project.duration_seconds != null && (
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white font-mono text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
              <Camera size={11} />
              {formatDuration(project.duration_seconds)}
            </div>
          )}
        </div>

        {/* MoreVertical button */}
        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            aria-label={t('pc_projectOptions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="w-9 h-9 rounded-lg bg-background/80 backdrop-blur-sm border border-border/60 flex items-center justify-center text-[--text-muted] hover:text-foreground opacity-70 group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-all duration-200"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <ContextMenu
              project={project}
              onClose={() => setMenuOpen(false)}
              onDelete={handleDelete}
              onRename={handleRename}
              onEditAsNew={handleEditAsNew}
              onPreview={() => setPreviewOpen(true)}
              onMove={() => setMoveOpen(true)}
            />
          )}
        </div>

        {/* Info */}
        <div className="px-3 py-2.5">
          <p className="font-display text-sm font-semibold text-foreground truncate leading-snug">
            {localTitle ?? t('pc_untitled')}
          </p>
          <p className="font-mono text-xs text-[--text-muted] mt-0.5">
            {formatRelativeDate(project.created_at, t)} · {moduleLabel}
          </p>

          {/* Error recovery */}
          {isError && (
            <button
              type="button"
              onClick={handleRevertToDraft}
              disabled={reverting}
              className={cn(
                'mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg',
                'border border-amber-500/30 bg-amber-500/5',
                'font-mono text-[11px] text-amber-500 hover:bg-amber-500/10',
                'transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {reverting
                ? <Loader2 size={11} className="animate-spin" />
                : <RotateCcw size={11} />}
              {reverting ? t('pc_saving') : t('pc_saveDraft')}
            </button>
          )}

          {/* Brand kit CTA */}
          {isBrand && isDone && (
            <button
              type="button"
              onClick={() => router.push(brandHubHref)}
              className={cn(
                'mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg',
                'border border-amber-500/30 bg-amber-500/5',
                'font-mono text-[11px] text-amber-400 hover:bg-amber-500/10',
                'transition-colors',
              )}
            >
              <ExternalLink size={11} /> {t('pc_viewBrandKit')}
            </button>
          )}
        </div>
      </div>

      {/* Video preview modal */}
      {previewOpen && project.output_url && !isBrand && (
        <VideoPreviewModal
          title={localTitle}
          videoUrl={project.output_url}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Move-to-folder modal */}
      <MoveToFolderModal
        isOpen={moveOpen}
        onClose={() => setMoveOpen(false)}
        videoId={project.id}
        currentFolderId={localFolderId}
        onMoved={(folder) => setLocalFolderId(folder?.id ?? null)}
      />
    </>
  )
}
