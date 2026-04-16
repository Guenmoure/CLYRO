'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Video, Sparkles, Palette, Loader2, AlertCircle, MoreHorizontal,
  Pencil, Trash2, ExternalLink, Download, Play, FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RealtimeProjects } from './RealtimeProjects'
import type { VideoProject } from './ProjectCard'

interface RecentProjectsProps {
  userId: string
  videos: VideoProject[]
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  faceless: Video,
  motion:   Sparkles,
  brand:    Palette,
}
const MODULE_COLORS: Record<string, string> = {
  faceless: 'text-blue-400 bg-blue-500/10',
  motion:   'text-purple-400 bg-purple-500/10',
  brand:    'text-cyan-400 bg-cyan-400/10',
}
const MODULE_LABELS: Record<string, string> = {
  faceless: 'Faceless',
  motion:   'Motion',
  brand:    'Brand Kit',
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins  = Math.floor(diff / 60_000)
  if (days > 30)  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  if (days > 1)   return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 0)  return `${hours}h ago`
  if (mins > 0)   return `${mins}m ago`
  return 'just now'
}

const PROCESSING_STATUSES = new Set(['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly'])

export function RecentProjects({ userId, videos: initialVideos }: RecentProjectsProps) {
  const [tab, setTab] = useState<'recent' | 'drafts'>('recent')
  const [projects, setProjects] = useState<VideoProject[]>(initialVideos)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const handleUpdate = useCallback((id: string, patch: Partial<VideoProject>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    setMenuOpenId(null)
  }, [])

  // Filter: Recent = done + error, Drafts = processing
  const filteredProjects = useMemo(() => {
    if (tab === 'recent') {
      return projects.filter(p => !PROCESSING_STATUSES.has(p.status)).slice(0, 6)
    }
    return projects.filter(p => PROCESSING_STATUSES.has(p.status)).slice(0, 6)
  }, [projects, tab])

  const recentCount = projects.filter(p => !PROCESSING_STATUSES.has(p.status)).length
  const draftCount  = projects.filter(p =>  PROCESSING_STATUSES.has(p.status)).length

  return (
    <div className="space-y-6">
      <RealtimeProjects userId={userId} onUpdate={handleUpdate} />

      {/* Tabs */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <TabButton
            label="Recent"
            count={recentCount}
            active={tab === 'recent'}
            onClick={() => setTab('recent')}
          />
          <TabButton
            label="Processing"
            count={draftCount}
            active={tab === 'drafts'}
            onClick={() => setTab('drafts')}
          />
        </div>
      </div>

      {/* List */}
      {filteredProjects.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-2">
          {filteredProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              menuOpen={menuOpenId === project.id}
              onMenuToggle={(open) => setMenuOpenId(open ? project.id : null)}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* See all */}
      {projects.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-body text-[--text-secondary] hover:text-foreground hover:border-border transition-all"
          >
            View all projects
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Tab button ─────────────────────────────────────────────────────────────────

function TabButton({ label, count, active, onClick }: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-body text-sm transition-all duration-200',
        active
          ? 'bg-foreground text-gray-950 shadow-sm'
          : 'text-[--text-muted] hover:text-foreground',
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-mono',
          active ? 'bg-background/10 text-gray-950' : 'bg-muted text-[--text-muted]',
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Project row ────────────────────────────────────────────────────────────────

function ProjectRow({ project, menuOpen, onMenuToggle, onDeleted }: {
  project: VideoProject
  menuOpen: boolean
  onMenuToggle: (open: boolean) => void
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const isProcessing = PROCESSING_STATUSES.has(project.status)
  const isError = project.status === 'error'
  const isDone = project.status === 'done'

  const ModuleIcon  = MODULE_ICONS[project.module ?? ''] ?? Video
  const moduleColor = MODULE_COLORS[project.module ?? ''] ?? 'text-[--text-muted] bg-muted'
  const moduleLabel = MODULE_LABELS[project.module ?? ''] ?? 'Projet'

  async function handleDelete() {
    if (!confirm('Delete this project? This action is permanent.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/videos/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDeleted(project.id)
    } catch {
      setDeleting(false)
    }
  }

  function handleEdit() {
    onMenuToggle(false)
    router.push(`/projects?id=${project.id}`)
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 transition-all duration-200',
        'hover:border-border hover:bg-muted/50',
        deleting && 'opacity-40 pointer-events-none',
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
        <div className="absolute inset-0 flex items-center justify-center">
          {isProcessing ? (
            <Loader2 size={20} className="text-blue-400 animate-spin" />
          ) : isError ? (
            <AlertCircle size={20} className="text-error" />
          ) : (
            <Play size={18} className={cn('opacity-60', moduleColor.split(' ')[0])} fill="currentColor" />
          )}
        </div>
        {isDone && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-foreground truncate">
          {project.title ?? 'Untitled project'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded', moduleColor)}>
            <ModuleIcon size={9} />
            {moduleLabel}
          </span>
          <span className="text-xs text-[--text-muted]">·</span>
          <span className="text-xs font-body text-[--text-muted]">
            {formatRelativeDate(project.created_at)}
          </span>
          {isProcessing && (
            <>
              <span className="text-xs text-[--text-muted]">·</span>
              <span className="text-xs font-mono text-blue-400">processing…</span>
            </>
          )}
          {isError && (
            <>
              <span className="text-xs text-[--text-muted]">·</span>
              <span className="text-xs font-mono text-error">error</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isDone && (
          <button
            type="button"
            onClick={handleEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 font-body text-xs text-foreground hover:bg-border transition-all"
          >
            Open
          </button>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => onMenuToggle(!menuOpen)}
            aria-label="Project options"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[--text-muted] hover:bg-border hover:text-foreground transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-card shadow-2xl z-20 overflow-hidden">
              {project.output_url && (
                <a
                  href={project.output_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onMenuToggle(false)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ExternalLink size={13} /> Open in new tab
                </a>
              )}
              {project.output_url && (
                <a
                  href={project.output_url}
                  download
                  onClick={() => onMenuToggle(false)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Download size={13} /> Download
                </a>
              )}
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors"
              >
                <Pencil size={13} /> Rename
              </button>
              <div className="border-t border-border" />
              <button
                type="button"
                onClick={() => { onMenuToggle(false); handleDelete() }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-body text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: 'recent' | 'drafts' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border bg-card/30">
      <div className="rounded-2xl bg-muted p-4 mb-4">
        <FolderOpen size={28} className="text-[--text-muted]" />
      </div>
      <p className="font-display text-sm text-foreground">
        {tab === 'recent' ? 'No projects yet' : 'No projects processing'}
      </p>
      <p className="font-body text-xs text-[--text-muted] mt-2 max-w-xs">
        {tab === 'recent'
          ? 'Create your first project in under 5 minutes.'
          : 'Projects being generated will show up here.'}
      </p>
      {tab === 'recent' && (
        <Link
          href="/faceless/new"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-display text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Create my first project
        </Link>
      )}
    </div>
  )
}
