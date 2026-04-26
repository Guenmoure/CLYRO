'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Video, Sparkles, Play, Trash2, Palette, Clapperboard,
  MoreVertical, Copy, FilePlus, Users, Pencil, FolderInput, Gem,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DbDraftMeta {
  id:           string
  module:       'faceless' | 'motion' | 'brand' | 'studio'
  title:        string
  wizard_step:  number | null
  wizard_state: Record<string, unknown> | null
  updated_at:   string
}

interface DraftCardProps {
  draft:    DbDraftMeta
  onDelete: () => void
}

// ── Config ─────────────────────────────────────────────────────────────────────

const MODULE_CONFIG: Record<string, {
  Icon: React.FC<any>; iconColor: string; iconBg: string
  label: string; gradFrom: string; gradTo: string; totalSteps: number
}> = {
  faceless: {
    Icon:       Video,
    iconColor:  'text-blue-400',
    iconBg:     'bg-blue-500/10',
    label:      'Faceless Video',
    gradFrom:   'from-blue-500',
    gradTo:     'to-blue-600',
    totalSteps: 6,
  },
  motion: {
    Icon:       Sparkles,
    iconColor:  'text-purple-400',
    iconBg:     'bg-purple-500/10',
    label:      'Motion Design',
    gradFrom:   'from-purple-500',
    gradTo:     'to-blue-500',
    totalSteps: 5,
  },
  brand: {
    Icon:       Palette,
    iconColor:  'text-amber-400',
    iconBg:     'bg-amber-500/10',
    label:      'Brand Kit',
    gradFrom:   'from-amber-500',
    gradTo:     'to-orange-500',
    totalSteps: 6,
  },
  studio: {
    Icon:       Clapperboard,
    iconColor:  'text-emerald-400',
    iconBg:     'bg-emerald-500/10',
    label:      'AI Studio',
    gradFrom:   'from-emerald-500',
    gradTo:     'to-teal-500',
    totalSteps: 1,
  },
}

function formatRelative(iso: string, t: (k: string) => string): string {
  const diffMs  = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1)  return t('time_justNow')
  if (diffMin < 60) return t('time_minAgo').replace('{n}', String(diffMin))
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return t('time_hAgo').replace('{n}', String(diffH))
  return t('time_dAgo').replace('{n}', String(Math.floor(diffH / 24)))
}

// ── Context menu ───────────────────────────────────────────────────────────────

function DraftContextMenu({
  draft,
  moduleLabel,
  onClose,
  onDelete,
  onRename,
  onEditAsNew,
  onResume,
}: {
  draft: DbDraftMeta
  moduleLabel: string
  onClose: () => void
  onDelete: () => void
  onRename: () => void
  onEditAsNew: () => void
  onResume: () => void
}) {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function copyId() {
    navigator.clipboard.writeText(draft.id).catch(() => null)
    toast.success(t('dc_idCopied'))
    onClose()
  }

  const item = 'flex items-center gap-3 px-4 py-2.5 text-sm font-body text-foreground hover:bg-muted transition-colors w-full text-left'
  const itemDisabled = 'flex items-center gap-3 px-4 py-2.5 text-sm font-body text-[--text-muted] w-full text-left cursor-not-allowed'
  const soonBadge = 'ml-auto inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[--text-muted]'

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute top-9 right-0 w-52 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
    >
      {/* Header — module label */}
      <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
        {moduleLabel} · {t('dc_draft')}
      </p>

      {/* Actions */}
      <div className="py-1">
        <button type="button" role="menuitem" onClick={copyId} className={item}>
          <Copy size={14} aria-hidden="true" /> {t('dc_copyId')}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onResume() }}
          className={item}
        >
          <Play size={14} aria-hidden="true" /> {t('dc_resume')}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onEditAsNew() }}
          className={item}
        >
          <FilePlus size={14} aria-hidden="true" /> {t('dc_duplicate')}
        </button>

        <button type="button" disabled className={itemDisabled} aria-disabled="true">
          <Users size={14} aria-hidden="true" />
          <span>{t('dc_collaborate')}</span>
          <Gem size={12} className="text-warning ml-auto" aria-hidden="true" />
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onRename() }}
          className={item}
        >
          <Pencil size={14} aria-hidden="true" /> {t('dc_rename')}
        </button>

        <button type="button" disabled className={itemDisabled} aria-disabled="true">
          <FolderInput size={14} aria-hidden="true" />
          <span>{t('dc_move')}</span>
          <span className={soonBadge}>{t('dc_soon')}</span>
        </button>
      </div>

      {/* Divider + Trash */}
      <div className="border-t border-border" />
      <div className="py-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onDelete() }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error hover:bg-error/10 transition-colors w-full text-left"
        >
          <Trash2 size={14} aria-hidden="true" /> {t('dc_delete')}
        </button>
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DraftCard({ draft, onDelete }: DraftCardProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [localTitle, setLocalTitle] = useState<string | null>(draft.title)
  const [renaming, setRenaming] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const config      = MODULE_CONFIG[draft.module] ?? MODULE_CONFIG.faceless!
  const { Icon }    = config
  const step        = draft.wizard_step ?? 1
  const totalSteps  = config.totalSteps
  const progressPct = Math.round((step / totalSteps) * 100)
  // Hub-originated drafts (faceless editor at /faceless) use a `hub: true`
  // marker in wizard_state. Route them back into the hub instead of the
  // /new setup wizard so the scenes + images are rehydrated.
  const isHubDraft =
    draft.module === 'faceless' &&
    !!draft.wizard_state &&
    typeof draft.wizard_state === 'object' &&
    (draft.wizard_state as Record<string, unknown>).hub === true
  const href = isHubDraft
    ? `/faceless?draft=${draft.id}`
    : `/${draft.module}/new?draft=${draft.id}`

  function handleResume() {
    router.push(href)
  }

  async function handleRename() {
    if (renaming) return
    const current = localTitle ?? t('dc_untitled')
    const next = typeof window === 'undefined' ? null : window.prompt(t('dc_renameDraft'), current)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === current) return

    setRenaming(true)
    try {
      const res = await fetch(`/api/videos/${draft.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json() as { title: string | null }
      setLocalTitle(updated.title ?? trimmed)
      router.refresh()
    } catch {
      toast.error(t('dc_renameError'))
    } finally {
      setRenaming(false)
    }
  }

  async function handleEditAsNew() {
    if (duplicating) return
    setDuplicating(true)
    toast.info(t('dc_duplicating'))
    try {
      const res = await fetch(`/api/videos/${draft.id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { id: newId, module, target } = await res.json() as {
        id: string; module: string; target: 'hub' | 'new'
      }
      router.push(`/${module}/${target}?draft=${newId}`)
    } catch {
      toast.error(t('dc_duplicateError'))
      setDuplicating(false)
    }
  }

  return (
    <div className={cn(
      'group relative rounded-2xl overflow-hidden',
      'bg-card border border-border/60',
      'hover:border-warning/30 hover:shadow-card-hover',
      'transition-all duration-200',
    )}>
      {/* Amber accent strip */}
      <div className="h-0.5 w-full bg-gradient-to-r from-warning/60 via-warning/30 to-transparent" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.iconBg)}>
            <Icon size={18} className={config.iconColor} strokeWidth={1.8} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display text-sm font-semibold text-foreground truncate">
                {localTitle || t('dc_untitled')}
              </p>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider shrink-0',
                'bg-warning/10 text-warning border border-warning/20',
              )}>
                {t('dc_draft')}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[--text-muted] mt-0.5">{config.label}</p>
          </div>

          {/* Inline confirm — quick path when the user wants to delete fast */}
          {confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onDelete}
                className="font-mono text-[11px] text-white bg-error px-2.5 py-1 rounded-lg hover:bg-error/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
              >
                {t('dc_confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="font-mono text-[11px] text-[--text-muted] px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              >
                {t('dc_cancel')}
              </button>
            </div>
          ) : (
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={t('dc_draftOptions')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                className={cn(
                  'w-11 h-11 rounded-lg flex items-center justify-center',
                  'text-[--text-muted] hover:text-foreground hover:bg-muted',
                  'border border-transparent hover:border-border/50',
                  'opacity-60 group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
                  'transition-all duration-200',
                )}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <DraftContextMenu
                  draft={draft}
                  moduleLabel={config.label}
                  onClose={() => setMenuOpen(false)}
                  onDelete={() => setConfirmDelete(true)}
                  onRename={handleRename}
                  onEditAsNew={handleEditAsNew}
                  onResume={handleResume}
                />
              )}
            </div>
          )}
        </div>

        {/* Step progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-[11px] text-[--text-muted]">
              {t('dc_step')} {step}/{totalSteps}
            </p>
            <p className="font-mono text-[11px] text-[--text-muted]">
              {formatRelative(draft.updated_at, t)}
            </p>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', config.gradFrom, config.gradTo)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push(href)}
          className={cn(
            'mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
            'bg-gradient-to-r from-blue-500 to-blue-600',
            'font-display text-sm font-semibold text-white',
            'hover:opacity-90 active:opacity-80 transition-opacity',
            'shadow-[0_4px_12px_rgba(59,142,240,0.25)]',
          )}
        >
          <Play size={13} className="fill-white" />
          {t('dc_resume')}
        </button>
      </div>
    </div>
  )
}
