'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Maximize } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudioProjectStatus } from '@/lib/studio-types'
import { useLanguage } from '@/lib/i18n'

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

export function StudioTopBar({
  projectId, title, status, scenesDone, scenesTotal,
  onTitleChange, onExport, onPreview,
}: StudioTopBarProps) {
  const { t } = useLanguage()

  const STATUS_META: Record<StudioProjectStatus, { label: string; color: string }> = {
    draft:      { label: t('st_statusDraft'),      color: 'bg-muted text-[--text-muted]' },
    analyzing:  { label: t('st_statusAnalyzing'),  color: 'bg-brand/15 text-brand' },
    generating: { label: t('st_statusGenerating'), color: 'bg-amber-500/15 text-amber-500' },
    editing:    { label: t('st_statusEditing'),    color: 'bg-brand/15 text-brand' },
    rendering:  { label: t('st_statusRendering'),  color: 'bg-purple-500/15 text-purple-500' },
    done:       { label: t('st_statusReady'),      color: 'bg-emerald-500/15 text-emerald-500' },
    error:      { label: t('st_statusError'),      color: 'bg-error/15 text-error' },
  }

  const meta = STATUS_META[status]
  // Audit 16/06/26 — show the bar across the full active lifecycle, not
  // just `generating` + `rendering`. During `analyzing` Claude is still
  // splitting the script so there's nothing to count yet — we render the
  // bar in indeterminate mode so the user sees motion instead of dead air.
  const isAnalyzing  = status === 'analyzing'
  const isGenerating = status === 'generating'
  const isRendering  = status === 'rendering'
  const showProgress = (isAnalyzing || isGenerating || isRendering)
    && (isAnalyzing || (scenesTotal !== undefined && scenesDone !== undefined))
  const pct = isAnalyzing
    ? null
    : Math.round((scenesDone! / Math.max(scenesTotal!, 1)) * 100)

  // Concrete label so the bar is self-explanatory — fixes the audit's
  // « plutôt qu'un toast générique » complaint.
  const progressLabel =
    isAnalyzing  ? t('st_progress_analyzing') :
    isGenerating ? t('st_progress_generating').replace('{done}', String(scenesDone)).replace('{total}', String(scenesTotal)) :
    isRendering  ? t('st_progress_rendering').replace('{done}', String(scenesDone)).replace('{total}', String(scenesTotal)) :
    ''
  return (
    <header className="h-12 shrink-0 bg-card border-b border-border/60 px-4 flex items-center justify-between gap-4">
      {/* Left — back + title + status */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('st_backToDashboard')}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-border" />
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="bg-transparent border-none font-display text-sm font-semibold text-foreground focus:outline-none min-w-0 flex-1 max-w-[360px]"
          aria-label={t('st_projectTitle')}
        />
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0', meta.color)}>
          {meta.label}
        </span>
        {/* projectId for debug/deeplink copy — hidden but selectable */}
        <span className="hidden font-mono text-[9px] text-[--text-muted]">{projectId}</span>
      </div>

      {/* Center — progress: label + bar (determinate during generation /
          rendering, indeterminate during analyze). aria-live so screen
          readers announce updates. */}
      {showProgress && (
        <div
          className="hidden md:flex items-center gap-3 flex-1 max-w-sm"
          role="status"
          aria-live="polite"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-secondary] shrink-0">
            {progressLabel}
          </span>
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            {isAnalyzing ? (
              // Indeterminate state — full-width gradient with a pulse so
              // there's motion without needing a custom keyframe.
              <div className="h-full w-full rounded-full bg-gradient-to-r from-brand to-violet-500 animate-pulse" />
            ) : (
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-violet-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
          {pct !== null && (
            <span className="font-mono text-[10px] text-[--text-secondary] shrink-0 w-10 text-right">
              {pct}%
            </span>
          )}
        </div>
      )}

      {/* Right — actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" leftIcon={<Maximize size={12} />} onClick={onPreview}>
          {t('st_preview')}
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Download size={12} />} onClick={onExport}>
          {t('st_export')}
        </Button>
      </div>
    </header>
  )
}
