'use client'

import { Sparkles } from 'lucide-react'

interface SuggestionCardProps {
  title: string
  description: string
  onUse: () => void
}

/**
 * Mini-card de suggestion (« Suggestions based on Business DNA ») —
 * Phase 3.2. Pas d'image (génération coûte cher) : juste titre +
 * description, et un clic préremplit la prompt box.
 */
export function SuggestionCard({ title, description, onUse }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="group text-left rounded-2xl border border-border bg-card hover:border-foreground/40 transition-colors p-4 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 text-[--text-muted] group-hover:text-foreground transition-colors">
        <Sparkles size={12} />
        <span className="font-mono text-[10px] uppercase tracking-wider">Suggestion</span>
      </div>
      <h4 className="font-display text-sm font-semibold text-foreground line-clamp-2">{title}</h4>
      <p className="font-body text-xs text-[--text-muted] line-clamp-3 flex-1">{description}</p>
      <span className="font-mono text-[10px] text-[--text-muted] group-hover:text-foreground transition-colors mt-1">
        Use this prompt →
      </span>
    </button>
  )
}
