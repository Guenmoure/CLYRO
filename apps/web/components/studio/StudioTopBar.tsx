'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Maximize } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudioProjectStatus } from '@/lib/studio-types'

interface StudioTopBarProps {
  projectId: string
  title: string
  status: StudioProjectStatus
  scenesDone?: number
  scenesTotal?: number
  onTitleChange?: (title: string) => void
  onExport?: () => void
  onPreview?: () => void
}

const STATUS_META: Record<StudioProjectStatus, { label: string; color: string }> = {
  draft:      { label: 'Draft',       color: 'bg-muted text-[--text-muted]' },
  analyzing:  { label: 'Analyzing',   color: 'bg-blue-500/15 text-blue-500' },
  generating: { label: 'Generating',  color: 'bg-amber-500/15 text-amber-500' },
  editing:    { label: 'Editing',     color: 'bg-blue-500/15 text-blue-500' },
  rendering:  { label: 'Rendering',   color: 'bg-purple-500/15 text-purple-500' },
  done:       { label: 'Ready',       color: 'bg-emerald-500/15 text-emerald-500' },
  error:      { label: 'Error',       color: 'bg-error/15 text-error' },
}

export function StudioTopBar({
  projectId, title, status, scenesDone, scenesTotal,
  onTitleChange, onExport, onPreview,
}: StudioTopBarProps) {
  const meta = STATUS_META[status]
  const showProgress = (status === 'generating' || status === 'rendering') && scenesTotal && scenesDone !== undefined
  return (
    <header className="h-12 shrink-0 bg-card border-b border-border/60 px-4 flex items-center justify-between gap-4">
      {/* Left — back + title + status */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-border" />
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="bg-transparent border-none font-display text-sm font-semibold text-foreground focus:outline-none min-w-0 flex-1 max-w-[360px]"
          aria-label="Project title"
        />
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0', meta.color)}>
          {meta.label}
        </span>
        {/* projectId for debug/deeplink copy — hidden but selectable */}
        <span className="hidden font-mono text-[9px] text-[--text-muted]">{projectId}</span>
      </div>

      {/* Center — progress if generating */}
      {showProgress && (
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${Math.round((scenesDone! / scenesTotal!) * 100)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-[--text-secondary] shrink-0">
            {scenesDone}/{scenesTotal}
          </span>
        </div>
      )}

      {/* Right — actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" leftIcon={<Maximize size={12} />} onClick={onPreview}>
          Preview
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Download size={12} />} onClick={onExport}>
          Export
        </Button>
      </div>
    </header>
  )
}
