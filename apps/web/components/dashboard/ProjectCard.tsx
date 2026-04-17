'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Video, Sparkles, Palette, MoreVertical,
  Copy, Download, FilePlus, Users, Pencil,
  FolderInput, Trash2, Gem, Camera, RotateCcw, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

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
}

const MODULE_ICON_COLORS: Record<string, string> = {
  faceless: 'text-blue-400',
  motion:   'text-purple-400',
  brand:    'text-cyan-400',
}

/** Gradient placeholder shown when a project has no thumbnail yet */
const MODULE_GRADIENTS: Record<string, string> = {
  faceless: 'from-blue-900/60 via-blue-800/30 to-indigo-900/40',
  motion:   'from-purple-900/60 via-violet-800/30 to-indigo-900/40',
  brand:    'from-cyan-900/50 via-teal-800/30 to-slate-900/40',
  studio:   'from-rose-900/50 via-pink-800/30 to-slate-900/40',
}

function formatRelativeDate(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins  = Math.floor(diff / 60_000)
  if (days > 30)  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  if (days > 1)   return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 0)  return `${hours}h ago`
  if (mins > 0)   return `${mins} min ago`
  return 'Just now'
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

// ── Context menu ───────────────────────────────────────────────────────────────

function ContextMenu({
  project,
  onClose,
  onDelete,
}: {
  project: VideoProject
  onClose: () => void
  onDelete: () => void
}) {
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
    onClose()
  }

  const item = 'flex items-center gap-3 px-4 py-2.5 text-sm font-body text-foreground hover:bg-muted transition-colors w-full text-left'

  return (
    <div
      ref={ref}
      className="absolute top-9 right-0 w-52 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
        Created by {project.created_by ?? 'Molnim'}
      </p>

      {/* Actions */}
      <div className="py-1">
        <button type="button" onClick={copyId} className={item}>
          <Copy size={14} /> Copy ID
        </button>
        {project.output_url ? (
          <a href={project.output_url} download onClick={onClose} className={item}>
            <Download size={14} /> Download
          </a>
        ) : (
          <button type="button" disabled onClick={onClose} className={cn(item, 'opacity-40 cursor-not-allowed')}>
            <Download size={14} /> Download
          </button>
        )}
        <button type="button" onClick={onClose} className={item}>
          <FilePlus size={14} /> Edit as New
        </button>
        <button type="button" onClick={onClose} className={item}>
          <Users size={14} />
          <span className="flex-1">Collaborate</span>
          <Gem size={13} className="text-warning" />
        </button>
        <button type="button" onClick={onClose} className={item}>
          <Pencil size={14} /> Rename
        </button>
        <button type="button" onClick={onClose} className={item}>
          <FolderInput size={14} /> Move
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
          <Trash2 size={14} /> Trash
        </button>
      </div>
    </div>
  )
}

// ── ProjectCard ────────────────────────────────────────────────────────────────

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const router = useRouter()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [deleted,    setDeleted]    = useState(false)
  const [reverting,  setReverting]  = useState(false)

  const isProcessing = ['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly'].includes(project.status)
  const isError      = project.status === 'error'

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

  const ModuleIcon    = MODULE_ICONS[project.module ?? ''] ?? Video
  const iconColor     = MODULE_ICON_COLORS[project.module ?? ''] ?? 'text-[--text-muted]'
  const moduleGradient = MODULE_GRADIENTS[project.module ?? ''] ?? 'from-slate-900/50 via-slate-800/30 to-slate-900/40'

  const moduleLabel = project.module
    ? project.module.charAt(0).toUpperCase() + project.module.slice(1) + ' Video'
    : 'Video'

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/videos/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleted(true)
      onDeleted?.(project.id)
    } catch {
      setDeleting(false)
    }
  }

  if (deleted) return null

  return (
    <div className={cn(
      'group relative rounded-2xl overflow-hidden',
      'bg-card border border-border/60',
      'hover:border-border hover:shadow-card-hover',
      'transition-all duration-200',
      deleting && 'opacity-50 pointer-events-none',
    )}>

      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-card">
        {/* Gradient placeholder — always present, hidden under thumbnail when loaded */}
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
            alt={project.title ?? 'Project'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}

        {/* Hover play overlay — only when video is ready */}
        {project.output_url && !isProcessing && !isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
            <div className={cn(
              'w-11 h-11 rounded-full bg-white/90 shadow-lg',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100',
              'transition-all duration-200',
            )}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-900 ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Status badge — top-left */}
        <div className="absolute top-2 left-2">
          {isProcessing && <Badge variant="info" dot>Processing</Badge>}
          {isError && <Badge variant="error">Error</Badge>}
        </div>

        {/* Duration chip — bottom-right */}
        {project.duration_seconds != null && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white font-mono text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
            <Camera size={11} />
            {formatDuration(project.duration_seconds)}
          </div>
        )}
      </div>

      {/* MoreVertical button — outside thumbnail to avoid overflow-hidden clip */}
      <div className="absolute top-2 right-2 z-10">
        <button
          type="button"
          aria-label="Project options"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
          className="w-7 h-7 rounded-lg bg-background/70 backdrop-blur-sm border border-border/50 flex items-center justify-center text-[--text-muted] hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
        >
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <ContextMenu
            project={project}
            onClose={() => setMenuOpen(false)}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="font-display text-sm font-semibold text-foreground truncate leading-snug">
          {project.title ?? 'Untitled'}
        </p>
        <p className="font-mono text-xs text-[--text-muted] mt-0.5">
          {formatRelativeDate(project.created_at)} · {moduleLabel}
        </p>

        {/* Error recovery — save as draft so the user can resume without re-entering everything */}
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
            {reverting ? 'Saving…' : 'Save as draft to resume'}
          </button>
        )}
      </div>
    </div>
  )
}
