'use client'

import React, { useState } from 'react'
import { Video, Sparkles, Play, Trash2, Palette, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

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

function formatRelative(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1)  return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `il y a ${diffH}h`
  return `il y a ${Math.floor(diffH / 24)}j`
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DraftCard({ draft, onDelete }: DraftCardProps) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const config      = MODULE_CONFIG[draft.module] ?? MODULE_CONFIG.faceless!
  const { Icon }    = config
  const step        = draft.wizard_step ?? 1
  const totalSteps  = config.totalSteps
  const progressPct = Math.round((step / totalSteps) * 100)
  const href        = `/${draft.module}/new?draft=${draft.id}`

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
                {draft.title || 'Sans titre'}
              </p>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0',
                'bg-warning/10 text-warning border border-warning/20',
              )}>
                Brouillon
              </span>
            </div>
            <p className="font-mono text-[11px] text-[--text-muted] mt-0.5">{config.label}</p>
          </div>

          {/* Delete */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Supprimer le brouillon"
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                'text-[--text-muted] hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20',
                'opacity-0 group-hover:opacity-100 transition-all duration-200',
              )}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onDelete}
                className="font-mono text-[10px] text-white bg-error px-2.5 py-1 rounded-lg hover:bg-error/80 transition-colors"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="font-mono text-[10px] text-[--text-muted] px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Step progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-[11px] text-[--text-muted]">
              Étape {step}/{totalSteps}
            </p>
            <p className="font-mono text-[11px] text-[--text-muted]">
              {formatRelative(draft.updated_at)}
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
          Reprendre
        </button>
      </div>
    </div>
  )
}
