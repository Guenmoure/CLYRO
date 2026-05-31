'use client'

import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Trash2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandCampaign } from '@clyro/shared'

interface CampaignCardProps {
  campaign: BrandCampaign
  kitId:    string
  onDelete?: () => void
}

const STATUS_META: Record<BrandCampaign['status'], { label: string; cls: string; Icon?: LucideIcon }> = {
  draft:      { label: 'Draft',      cls: 'text-[--text-muted] bg-muted' },
  generating: { label: 'Generating', cls: 'text-blue-700 bg-blue-100',   Icon: Loader2 },
  done:       { label: 'Ready',      cls: 'text-emerald-700 bg-emerald-100', Icon: CheckCircle2 },
  error:      { label: 'Error',      cls: 'text-error bg-error/10',      Icon: AlertCircle },
}

export function CampaignCard({ campaign, kitId, onDelete }: CampaignCardProps) {
  const meta = STATUS_META[campaign.status]
  const Icon = meta.Icon
  const inner = (
    <div className="h-full flex flex-col gap-2 p-4 rounded-2xl border border-border bg-card hover:border-foreground/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', meta.cls)}>
          {Icon && <Icon size={10} className={campaign.status === 'generating' ? 'animate-spin' : undefined} />}
          {meta.label}
        </span>
        <span className="font-mono text-[10px] text-[--text-muted]">{campaign.aspect_ratio}</span>
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground line-clamp-2">{campaign.title}</h3>
      {campaign.description && (
        <p className="font-body text-xs text-[--text-muted] line-clamp-2 flex-1">{campaign.description}</p>
      )}
      <p className="font-mono text-[10px] text-[--text-muted] line-clamp-1 italic">
        “{campaign.prompt.slice(0, 80)}{campaign.prompt.length > 80 ? '…' : ''}”
      </p>
    </div>
  )

  // generating + done -> cliquable vers le détail (Phase 3.3) ; error/draft non
  const clickable = campaign.status === 'done' || campaign.status === 'generating'

  return (
    <div className="group relative">
      {clickable ? (
        <Link href={`/brand/${kitId}/campaigns/${campaign.id}`} className="block">{inner}</Link>
      ) : (
        <div>{inner}</div>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}
          aria-label="Delete campaign"
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-background/80 backdrop-blur p-1.5 text-[--text-muted] hover:text-error z-10"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}
