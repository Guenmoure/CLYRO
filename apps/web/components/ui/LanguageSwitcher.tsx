'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const LANGUAGES: Array<{ code: Language; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
]

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)

  const currentLang = LANGUAGES.find((l) => l.code === lang)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Audit 23/06/26 — editorial pill : rounded-full + mono uppercase
          to match the new topbar / sidebar voice. */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-full',
          'border border-border bg-card hover:border-foreground',
          'font-mono text-[10px] uppercase tracking-[0.14em] text-foreground',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
        aria-label="Language switcher"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe size={12} className="text-[--text-muted]" />
        <span className="hidden sm:inline">{currentLang?.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div
            role="menu"
            className={cn(
              'absolute top-full right-0 mt-2 min-w-[200px] z-50 overflow-hidden',
              'rounded-xl border border-border bg-card shadow-xl',
            )}
          >
            <div className="px-4 py-2 border-b border-border">
              <span className="eyebrow">Language</span>
            </div>
            {LANGUAGES.map((lang_item) => (
              <button
                key={lang_item.code}
                onClick={() => {
                  setLang(lang_item.code)
                  setOpen(false)
                }}
                role="menuitemradio"
                aria-checked={lang === lang_item.code}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                  lang === lang_item.code
                    ? 'text-foreground bg-muted'
                    : 'text-[--text-secondary] hover:text-foreground hover:bg-muted/60',
                )}
              >
                <span className="text-base leading-none">{lang_item.flag}</span>
                <span className="flex-1">{lang_item.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--text-muted]">
                  {lang_item.code}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
