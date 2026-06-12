'use client'

import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

export interface ProductCardProps {
  id?: string
  name: string
  imageUrl: string
  description?: string | null
  category?: string | null
  onDelete?: () => void
  className?: string
}

/**
 * Card produit catalogue, style Pomelli. Image carrée en haut, infos en bas.
 * Bouton trash en hover si onDelete fourni.
 */
export function ProductCard({ name, imageUrl, description, category, onDelete, className }: ProductCardProps) {
  const { t } = useLanguage()
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card hover:border-foreground/30 transition-colors', className)}>
      <div className="aspect-square bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 space-y-1">
        <h4 className="font-display text-sm font-medium text-foreground truncate" title={name}>{name}</h4>
        {category && (
          <span className="inline-block font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{category}</span>
        )}
        {description && (
          <p className="font-body text-xs text-[--text-muted] line-clamp-2">{description}</p>
        )}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('bk_deleteProduct')}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-background/80 backdrop-blur p-1.5 text-[--text-muted] hover:text-error"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
