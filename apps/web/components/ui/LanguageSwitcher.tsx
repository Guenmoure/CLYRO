'use client'

import { useState } from 'react'
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

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border/50 bg-card/40 hover:bg-card/60 text-[--text-secondary] hover:text-foreground transition-all group"
        aria-label="Language switcher"
        aria-expanded={open}
      >
        <Globe size={16} className="group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium hidden sm:inline">{currentLang?.code.toUpperCase()}</span>
      </button>

      {/* Dropdown menu */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 min-w-[180px] rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg z-50 overflow-hidden">
            {LANGUAGES.map((lang_item) => (
              <button
                key={lang_item.code}
                onClick={() => {
                  setLang(lang_item.code)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body transition-colors text-left border-b border-border/30 last:border-b-0',
                  lang === lang_item.code
                    ? 'bg-blue-500/10 text-blue-500 font-semibold'
                    : 'text-[--text-secondary] hover:text-foreground hover:bg-muted/50',
                )}
              >
                <span>{lang_item.flag}</span>
                <span>{lang_item.label}</span>
                {lang === lang_item.code && (
                  <span className="ml-auto text-xs font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
