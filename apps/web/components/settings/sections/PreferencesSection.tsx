'use client'

import { useEffect, useState } from 'react'
import { Check, Globe, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type ThemeMode = 'light' | 'dark' | 'auto'

const LANGUAGES = [
  { code: 'fr', label: 'Français',        flag: '🇫🇷' },
  { code: 'en', label: 'English',         flag: '🇬🇧' },
  { code: 'es', label: 'Español',         flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch',         flag: '🇩🇪' },
  { code: 'pt', label: 'Português',       flag: '🇵🇹' },
]

const USE_CASES = [
  'Apprentissage & développement',
  'Marketing & promotion',
  'Inspiration & motivation',
  'Divertissement',
  'Sensibilisation',
  'Prospection commerciale',
  'Communication interne',
]

export function PreferencesSection() {
  const [language, setLanguage] = useState('fr')
  const [theme, setTheme]       = useState<ThemeMode>('auto')
  const [selectedUseCases, setSelectedUseCases] = useState<Set<string>>(new Set())

  // Load theme + language from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('clyro_theme') as ThemeMode | null
    if (savedTheme) setTheme(savedTheme)
    const savedLang = localStorage.getItem('clyro_language')
    if (savedLang) setLanguage(savedLang)
    const savedCases = localStorage.getItem('clyro_use_cases')
    if (savedCases) {
      try { setSelectedUseCases(new Set(JSON.parse(savedCases))) } catch { /* ignore */ }
    }
  }, [])

  function applyTheme(mode: ThemeMode) {
    setTheme(mode)
    localStorage.setItem('clyro_theme', mode)
    const html = document.documentElement
    if (mode === 'dark') html.classList.add('dark')
    else if (mode === 'light') html.classList.remove('dark')
    else {
      // auto
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      html.classList.toggle('dark', prefersDark)
    }
  }

  function selectLanguage(code: string) {
    setLanguage(code)
    localStorage.setItem('clyro_language', code)
  }

  function toggleUseCase(uc: string) {
    setSelectedUseCases((prev) => {
      const next = new Set(prev)
      if (next.has(uc)) next.delete(uc); else next.add(uc)
      localStorage.setItem('clyro_use_cases', JSON.stringify(Array.from(next)))
      return next
    })
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Préférences</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Langue, apparence et contexte d&apos;utilisation.
        </p>
      </div>

      {/* Language */}
      <section className="space-y-3">
        <label className="font-body text-sm font-semibold text-foreground">Langue</label>
        <div className="relative">
          <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
          <select
            value={language}
            onChange={(e) => selectLanguage(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm font-body text-foreground focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
            aria-label="Langue"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
            ))}
          </select>
        </div>
        <p className="font-body text-xs text-[--text-muted]">La langue par défaut des scripts générés par l&apos;IA.</p>
      </section>

      {/* Appearance */}
      <section className="space-y-3">
        <label className="font-body text-sm font-semibold text-foreground">Apparence</label>
        <div className="grid grid-cols-3 gap-3">
          <ThemeCard
            mode="light"
            label="Clair"
            icon={Sun}
            active={theme === 'light'}
            onClick={() => applyTheme('light')}
          />
          <ThemeCard
            mode="auto"
            label="Auto"
            icon={Monitor}
            active={theme === 'auto'}
            onClick={() => applyTheme('auto')}
          />
          <ThemeCard
            mode="dark"
            label="Sombre"
            icon={Moon}
            active={theme === 'dark'}
            onClick={() => applyTheme('dark')}
          />
        </div>
      </section>

      {/* Use cases */}
      <section className="space-y-3">
        <div>
          <label className="font-body text-sm font-semibold text-foreground">Cas d&apos;usage</label>
          <p className="font-body text-xs text-[--text-secondary] mt-1">
            Sélectionne ce qui s&apos;applique à ton activité pour personnaliser les suggestions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {USE_CASES.map((uc) => {
            const active = selectedUseCases.has(uc)
            return (
              <button
                key={uc}
                type="button"
                onClick={() => toggleUseCase(uc)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-body transition-all',
                  active
                    ? 'border-blue-500/60 bg-blue-500/10 text-blue-500 font-medium'
                    : 'border-border bg-background text-[--text-secondary] hover:text-foreground hover:border-border',
                )}
                aria-pressed={active}
              >
                {active && <Check size={12} />}
                {uc}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Theme preview card ────────────────────────────────────────────────────

function ThemeCard({
  mode, label, icon: Icon, active, onClick,
}: {
  mode: ThemeMode
  label: string
  icon: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Thème ${label}`}
      aria-pressed={active}
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-3 transition-all',
        active
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-border hover:border-border card-interactive',
      )}
    >
      {/* Preview surface */}
      <div className={cn(
        'rounded-xl border aspect-[16/9] flex items-center justify-center relative overflow-hidden',
        mode === 'light' && 'bg-white border-gray-200',
        mode === 'dark'  && 'bg-[#0A0D1A] border-gray-800',
        mode === 'auto'  && 'bg-gradient-to-r from-white to-[#0A0D1A] border-gray-400',
      )}>
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          mode === 'light' ? 'bg-gray-100' : mode === 'dark' ? 'bg-gray-800' : 'bg-gradient-to-r from-gray-100 to-gray-800',
        )}>
          <Icon size={18} className={mode === 'light' ? 'text-gray-700' : 'text-gray-300'} />
        </div>
        {active && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
            <Check size={11} className="text-white" />
          </div>
        )}
      </div>
      <p className={cn(
        'font-body text-sm text-center mt-2 transition-colors',
        active ? 'text-foreground font-semibold' : 'text-[--text-secondary]',
      )}>
        {label}
      </p>
    </button>
  )
}
