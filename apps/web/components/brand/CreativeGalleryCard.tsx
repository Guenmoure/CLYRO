'use client'

import { useState } from 'react'
import { Eye, EyeOff, Type, Sparkles, Share2, Loader2, MoreHorizontal, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import type { BrandCreative, CreativeBlocksVisible, CampaignAspectRatio } from '@clyro/shared'

interface CreativeGalleryCardProps {
  creative: BrandCreative
  aspectRatio: CampaignAspectRatio
  onToggleBlock: (block: keyof CreativeBlocksVisible, visible: boolean) => void
  onAnimate: () => void
  onShare: () => void
  onDelete: () => void
  /** URL de l'éditeur (Phase 3.4). Si fournie, l'image devient cliquable et
   *  un item "Edit" apparaît dans le menu more. */
  editHref?: string
  /** Pendant l'appel à Animate, désactive et affiche un loader. */
  animating?: boolean
}

const ASPECT_STYLES: Record<CampaignAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 270, height: 480 },
  '1:1':  { width: 360, height: 360 },
  '4:5':  { width: 320, height: 400 },
}

/**
 * Carte créative — Phase 3.3.
 * Image en background, text overlay rendu en HTML/CSS positionné absolu
 * pour permettre l'édition (drag arrivera en 3.4). Les toggles œil
 * cachent/affichent header / description / cta. Quatre boutons d'action
 * en dessous.
 */
export function CreativeGalleryCard({
  creative, aspectRatio, onToggleBlock, onAnimate, onShare, onDelete, editHref, animating,
}: CreativeGalleryCardProps) {
  const { t } = useLanguage()
  const dim = ASPECT_STYLES[aspectRatio]
  const blocks = creative.blocks_visible
  const [menuOpen, setMenuOpen] = useState(false)

  function block(key: keyof CreativeBlocksVisible, content: string | null) {
    if (!content) return null
    if (!blocks[key]) return null
    const positionCls =
      key === 'header'      ? 'top-3 left-3 right-3 text-base font-semibold leading-tight' :
      key === 'description' ? 'top-1/2 left-3 right-3 -translate-y-1/2 text-xs leading-snug' :
                              'bottom-3 left-3 right-3 text-xs font-medium uppercase tracking-wider'
    return (
      <div className={cn('absolute font-display text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]', positionCls)}>
        {content}
      </div>
    )
  }

  return (
    <div className="shrink-0 flex flex-col gap-2" style={{ width: dim.width }}>
      {/* Image + overlay — cliquable vers l'éditeur si editHref fourni. */}
      {editHref ? (
        <Link
          href={editHref}
          className="group/img relative rounded-2xl overflow-hidden border border-border bg-muted block"
          style={{ width: dim.width, height: dim.height }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creative.image_url} alt={creative.header_text || ''} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/40 pointer-events-none" />
          {block('header',      creative.header_text)}
          {block('description', creative.description_text)}
          {block('cta',         creative.cta_text)}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-foreground/30">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background text-foreground px-3 py-1.5 font-display text-xs font-medium shadow">
              <Pencil size={12} /> {t('edit')}
            </span>
          </div>
        </Link>
      ) : (
        <div
          className="relative rounded-2xl overflow-hidden border border-border bg-muted"
          style={{ width: dim.width, height: dim.height }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creative.image_url} alt={creative.header_text || ''} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/40 pointer-events-none" />
          {block('header',      creative.header_text)}
          {block('description', creative.description_text)}
          {block('cta',         creative.cta_text)}
        </div>
      )}

      {/* Toggles visibility (eye) */}
      <div className="flex items-center gap-1.5 px-1">
        <BlockToggle label={t('bk_ce_headerTitle')} on={blocks.header}      onClick={() => onToggleBlock('header', !blocks.header)} />
        <BlockToggle label={t('bk_cg_desc')}        on={blocks.description} onClick={() => onToggleBlock('description', !blocks.description)} />
        <BlockToggle label="CTA"                    on={blocks.cta}         onClick={() => onToggleBlock('cta', !blocks.cta)} />
      </div>

      {/* 4 boutons : more, share, Animate, retirer texte */}
      <div className="flex items-center gap-1.5 px-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t('bk_cg_more')}
            className="p-1.5 rounded-md border border-border bg-card text-[--text-muted] hover:text-foreground"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 bottom-full mb-1 z-10 rounded-md border border-border bg-card shadow-sm py-1 min-w-[120px]">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 font-mono text-[11px] text-error hover:bg-muted"
              >
                <Trash2 size={12} /> {t('delete')}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label={t('bk_cg_share')}
          className="p-1.5 rounded-md border border-border bg-card text-[--text-muted] hover:text-foreground"
        >
          <Share2 size={14} />
        </button>
        <button
          type="button"
          onClick={onAnimate}
          disabled={animating}
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-foreground text-background font-display text-[11px] font-medium',
            animating && 'opacity-50 cursor-not-allowed',
          )}
        >
          {animating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {t('bk_animate')}
        </button>
        <button
          type="button"
          onClick={() => {
            const allHidden = !blocks.header && !blocks.description && !blocks.cta
            // toggle all
            onToggleBlock('header',      allHidden)
            onToggleBlock('description', allHidden)
            onToggleBlock('cta',         allHidden)
          }}
          aria-label={t('bk_cg_toggleText')}
          className="p-1.5 rounded-md border border-border bg-card text-[--text-muted] hover:text-foreground"
        >
          <Type size={14} />
        </button>
      </div>
    </div>
  )
}

function BlockToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} ${on ? 'visible' : 'hidden'}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
        on ? 'text-foreground hover:bg-muted' : 'text-[--text-muted] hover:bg-muted',
      )}
    >
      {on ? <Eye size={10} /> : <EyeOff size={10} />}
      {label}
    </button>
  )
}
