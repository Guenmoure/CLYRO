'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'

const SUGGESTIONS = [
  'The 5 habits of millionaires',
  'How Bitcoin works in 2 minutes',
  'The secrets of deep sleep',
]

export function HeroScript() {
  const router               = useRouter()
  const [script, setScript]  = useState('')
  const [focused, setFocused] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  // Detect whether the visitor already has a session so we can skip /signup.
  useEffect(() => {
    let cancelled = false
    try {
      const supabase = createBrowserClient()
      supabase.auth.getSession().then(({ data }: any) => {
        if (!cancelled) setIsAuthed(!!data?.session)
      }).catch(() => { /* ignore — treat as logged-out */ })
    } catch { /* ignore */ }
    return () => { cancelled = true }
  }, [])

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
  const ready     = wordCount >= 5
  const estMin    = ready ? Math.max(1, Math.ceil(wordCount / 150)) : null

  function handleGenerate() {
    if (!ready) return
    const trimmed = script.trim()

    // Persist directly so the script survives any redirect round-trip
    // (auth callback, email confirmation, etc.) without URL-encoding issues.
    try {
      localStorage.setItem('clyro_prefilled_script', trimmed)
    } catch { /* privacy mode — fall back to URL param */ }

    // Logged-in users skip /signup and jump straight into the faceless flow.
    if (isAuthed) {
      router.push('/faceless/new')
      return
    }

    const encoded = encodeURIComponent(trimmed)
    router.push(`/signup?script=${encoded}`)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter → génère
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerate()
  }

  return (
    <div className="space-y-3 w-full">
      {/* Conteneur textarea + barre d'action */}
      <div
        className={cn(
          'relative rounded-2xl border transition-all duration-200',
          'bg-muted/60 backdrop-blur-sm',
          focused
            ? 'border-blue-500/60 shadow-[0_0_0_3px_rgba(77,159,255,0.12)]'
            : 'border-border hover:border-border/80',
        )}
      >
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder={"Paste your script here...\n\nExample: \"Octopuses are the most intelligent animals in the ocean. They can open jars, solve mazes, and change color in a fraction of a second...\""}
          rows={4}
          aria-label="Paste your video script"
          className={cn(
            'w-full bg-transparent px-4 pt-4 pb-14',
            'font-body text-sm text-foreground',
            'placeholder:text-[--text-muted]/60',
            'resize-none outline-none leading-relaxed',
          )}
        />

        {/* Barre du bas */}
        <div className="absolute bottom-0 inset-x-0 px-3 py-2.5 flex items-center justify-between border-t border-border/30">
          {/* Compteur de mots */}
          <span
            className={cn(
              'font-mono text-xs transition-colors select-none',
              ready ? 'text-[--text-muted]' : 'text-[--text-muted]/40',
            )}
          >
            {wordCount > 0
              ? `${wordCount} words · ~${estMin} min video`
              : 'Minimum 5 words'}
          </span>

          {/* Bouton Générer */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!ready}
            aria-label="Generate my video"
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-xl',
              'font-display text-sm font-medium transition-all duration-200',
              ready
                ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:shadow-[0_0_20px_rgba(77,159,255,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-muted text-[--text-muted] cursor-not-allowed',
            )}
          >
            <Zap size={13} />
            Generate my video →
          </button>
        </div>
      </div>

      {/* Suggestions rapides */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-[--text-muted]/60 shrink-0">Try:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScript(s)}
            className={cn(
              'font-mono text-xs transition-colors',
              'text-blue-400/70 hover:text-blue-400',
              'bg-blue-500/8 hover:bg-blue-500/15',
              'px-2.5 py-1 rounded-lg border border-blue-500/10',
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
