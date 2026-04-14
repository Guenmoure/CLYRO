'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Video, Sparkles, Palette, MoreVertical, Play,
  Download, Pencil, Trash2, ExternalLink,
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

const MODULE_BADGE_VARIANTS = {
  faceless: 'info',
  motion:   'purple',
  brand:    'neutral',
} as const

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins  = Math.floor(diff / 60_000)
  if (days > 30)  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (days > 1)   return `Il y a ${days} jours`
  if (days === 1) return 'Hier'
  if (hours > 0)  return `Il y a ${hours}h`
  if (mins > 0)   return `Il y a ${mins} min`
  return "À l'instant"
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

  const itemCls = 'flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors rounded-lg'

  return (
    <div
      ref={ref}
      className="absolute top-8 right-0 w-44 bg-card border border-border rounded-xl shadow-card overflow-hidden z-50"
    >
      <div className="p-1">
        {project.output_url && (
          <a href={project.output_url} target="_blank" rel="noopener noreferrer" onClick={onClose} className={itemCls}>
            <ExternalLink size={13} /> Ouvrir
          </a>
        )}
        {project.output_url && (
          <a href={project.output_url} download onClick={onClose} className={itemCls}>
            <Download size={13} /> Télécharger
          </a>
        )}
        <button type="button" onClick={onClose} className={itemCls}>
          <Pencil size={13} /> Renommer
        </button>
      </div>
      <div className="p-1 border-t border-border">
        <button
          type="button"
          onClick={() => { onClose(); onDelete() }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-error hover:bg-error/10 transition-colors rounded-lg"
        >
          <Trash2 size={13} /> Supprimer
        </button>
      </div>
    </div>
  )
}

// ── ProjectCard ────────────────────────────────────────────────────────────────

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [deleted, setDeleted]     = useState(false)

  const isDone       = project.status === 'done'
  const isProcessing = ['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly'].includes(project.status)
  const isError      = project.status === 'error'

  const ModuleIcon  = MODULE_ICONS[project.module ?? ''] ?? Video
  const iconColor   = MODULE_ICON_COLORS[project.module ?? ''] ?? 'text-[--text-muted]'

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
      'bg-muted border border-border',
      'hover:border-border hover:shadow-card-hover',
      'transition-all duration-200',
      // Module color left-border stripe
      project.module === 'faceless' && 'border-l-2 border-l-blue-500/50',
      project.module === 'motion'   && 'border-l-2 border-l-purple-500/50',
      project.module === 'brand'    && 'border-l-2 border-l-cyan-500/50',
      deleting && 'opacity-50 pointer-events-none',
    )}>
      {/* Thumbnail zone */}
      <div className="relative aspect-video overflow-hidden bg-card">
        {project.thumbnail_url ? (
          <Image
            src={project.thumbnail_url}
            alt={project.title ?? 'Projet'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ModuleIcon size={32} className={cn(iconColor, 'opacity-30')} />
          </div>
        )}

        {/* Hover overlay */}
        {isDone && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={() => router.push(`/projects?id=${project.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white font-display font-semibold text-xs rounded-lg hover:bg-blue-400 transition-colors"
            >
              <Play size={12} /> Ouvrir
            </button>
          </div>
        )}

        {/* Processing progress bar */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
            <div className="h-full bg-grad-primary animate-shimmer rounded-full" style={{ width: '60%' }} />
          </div>
        )}

        {/* Done accent */}
        {isDone && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
        )}

        {/* Status badge (top-left) */}
        <div className="absolute top-2 left-2">
          {isProcessing && <Badge variant="info" dot>En cours</Badge>}
          {isError && <Badge variant="error">Erreur</Badge>}
        </div>

        {/* More button (top-right) */}
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              className={cn(
                'w-7 h-7 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50',
                'flex items-center justify-center text-[--text-muted] hover:text-foreground',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              )}
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
        </div>
      </div>

      {/* Info zone */}
      <div className="px-3 py-3">
        <p className="font-display text-sm text-foreground truncate leading-snug">
          {project.title ?? 'Sans titre'}
        </p>
        <p className="font-mono text-xs text-[--text-muted] mt-0.5">
          {formatRelativeDate(project.created_at)}
        </p>
      </div>
    </div>
  )
}
