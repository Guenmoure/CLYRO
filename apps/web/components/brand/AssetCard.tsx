'use client'

import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

export interface AssetCardProps {
  url: string | null
  filename: string
  tags: string[]
  onDelete?: () => void
  onClick?: () => void
  className?: string
}

/**
 * Vignette pour la médiathèque (Pomelli Phase 2).
 * Petit, dense, image qui remplit, hover révèle les actions et un overlay
 * avec le nom de fichier et les tags. Clic ouvre une lightbox via onClick.
 */
export function AssetCard({ url, filename, tags, onDelete, onClick, className }: AssetCardProps) {
  const { t } = useLanguage()
  return (
    <div className={cn('group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted', className)}>
      {url ? (
        onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={filename}
            className="w-full h-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={filename}
              className="w-full h-full object-cover transition-transform group-hover:scale-105 rounded-xl"
              loading="lazy"
            />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[--text-muted]">
          {t('bk_unavailable')}
        </div>
      )}

      {/* Overlay hover : nom de fichier + tags */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-foreground/85 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="font-mono text-[10px] text-background truncate" title={filename}>{filename}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="font-mono text-[9px] text-background/90 rounded bg-background/15 px-1 py-px">{t}</span>
            ))}
            {tags.length > 3 && <span className="font-mono text-[9px] text-background/70">+{tags.length - 3}</span>}
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={t('bk_deleteAsset')}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-background/80 backdrop-blur p-1.5 text-[--text-muted] hover:text-error"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}
