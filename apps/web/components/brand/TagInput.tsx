'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  max?: number
  maxTagLength?: number
  /** Disable adding more (UI feedback when at max). */
  disabled?: boolean
  className?: string
}

/**
 * Input à chips, style Pomelli :
 * - Entrée ou virgule pour ajouter le tag en cours
 * - Backspace sur un input vide supprime le dernier tag
 * - Clic sur le × d'un chip le supprime
 * - Dédoublonné, trimmed, limité par `max` (défaut 20) et `maxTagLength` (60).
 *
 * Utilisé pour brand_values, brand_aesthetic, brand_tone_of_voice, keywords.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter…',
  max = 20,
  maxTagLength = 60,
  disabled = false,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const full = value.length >= max

  function commitDraft() {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (trimmed.length > maxTagLength) return
    if (value.includes(trimmed)) {
      setDraft('')
      return
    }
    if (full) return
    onChange([...value, trimmed])
    setDraft('')
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      e.preventDefault()
      removeAt(value.length - 1)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 min-h-[44px] focus-within:border-blue-500/60 transition-colors',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-card border border-border px-2 py-0.5 font-mono text-xs text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label={`Remove ${tag}`}
            className="text-[--text-muted] hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commitDraft}
        placeholder={full ? `Max ${max} tags` : placeholder}
        disabled={full}
        maxLength={maxTagLength}
        className="flex-1 min-w-[120px] bg-transparent outline-none font-body text-sm text-foreground placeholder-[--text-muted]"
      />
    </div>
  )
}
