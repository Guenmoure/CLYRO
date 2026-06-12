'use client'

import { Plus, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import type { CtaLink } from '@clyro/shared'

interface CtaLinkListProps {
  value: CtaLink[]
  onChange: (next: CtaLink[]) => void
  max?: number
}

/**
 * Liste éditable de paires {label, url}, plafonnée à `max` entrées (défaut 8).
 * Utilisée pour les boutons d'appel à l'action affichés dans les compositions
 * (« Visit our store », « Book a demo », etc.). Le label est obligatoire ; une
 * URL invalide est tolérée côté UI mais filtrée par Zod côté API.
 */
export function CtaLinkList({ value, onChange, max = 8 }: CtaLinkListProps) {
  const { t } = useLanguage()
  function updateAt(idx: number, patch: Partial<CtaLink>) {
    onChange(value.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function add() {
    if (value.length >= max) return
    onChange([...value, { label: '', url: '' }])
  }

  return (
    <div className="space-y-2">
      {value.map((cta, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 focus-within:border-blue-500/60 transition-colors"
        >
          <input
            type="text"
            value={cta.label}
            onChange={(e) => updateAt(i, { label: e.target.value })}
            placeholder={t('bk_cta_labelPh')}
            maxLength={60}
            className="w-40 bg-transparent outline-none font-body text-sm text-foreground placeholder-[--text-muted]"
          />
          <span className="text-[--text-muted] text-sm" aria-hidden="true">→</span>
          <input
            type="url"
            value={cta.url}
            onChange={(e) => updateAt(i, { url: e.target.value })}
            placeholder="https://…"
            maxLength={500}
            className="flex-1 bg-transparent outline-none font-body text-sm text-foreground placeholder-[--text-muted]"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label={t('bk_cta_removeAria')}
            className="text-[--text-muted] hover:text-error transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 font-body text-xs text-[--text-muted] hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus size={12} />
          {t('bk_cta_add')}
        </button>
      )}
    </div>
  )
}
