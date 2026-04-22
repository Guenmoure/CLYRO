// components/public/PublicShell.tsx
// Shared shell for public legal & resources pages (header + footer + lang toggle).
// Client component — manages a local `lang` state ("en" | "fr") with URL-hash
// persistence (#lang=fr) so the choice survives refreshes and deep links.
'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Twitter, Linkedin, Youtube, Instagram } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'

export type PubLang = 'en' | 'fr'

// ── Language hook ─────────────────────────────────────────────────────────────
// Reads/writes a ?lang=fr query param so the choice survives reloads and can
// be shared via URL. Falls back to <html lang> on first paint (SSR-safe).
export function usePubLang(): [PubLang, (l: PubLang) => void] {
  const [lang, setLang] = useState<PubLang>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlLang = params.get('lang')
    if (urlLang === 'fr' || urlLang === 'en') {
      setLang(urlLang)
      return
    }
    // Fallback to browser language
    const browserLang = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
    setLang(browserLang)
  }, [])

  function updateLang(next: PubLang) {
    setLang(next)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState({}, '', url.toString())
  }

  return [lang, updateLang]
}

// ── Language toggle button ────────────────────────────────────────────────────

function LangPill({ lang, onChange }: { lang: PubLang; onChange: (l: PubLang) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/50 bg-card/40 p-0.5">
      {(['en', 'fr'] as const).map((code) => (
        <button
          key={code}
          onClick={() => onChange(code)}
          className={cn(
            'px-2.5 h-7 rounded-md text-xs font-mono uppercase tracking-wider transition-colors',
            lang === code
              ? 'bg-foreground text-background'
              : 'text-[--text-muted] hover:text-foreground',
          )}
          aria-pressed={lang === code}
          aria-label={code === 'en' ? 'Switch to English' : 'Passer en français'}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

function PublicHeader({ lang, onLangChange }: { lang: PubLang; onLangChange: (l: PubLang) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Logo variant="full" size="sm" href="/" />
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-body text-[--text-secondary] hover:text-foreground transition-colors"
            aria-label={lang === 'fr' ? 'Retour à l\u2019accueil' : 'Back to home'}
          >
            <ArrowLeft size={14} />
            {lang === 'fr' ? 'Accueil' : 'Home'}
          </Link>
          <LangPill lang={lang} onChange={onLangChange} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

// ── Footer (mini, only essentials — no feature links to avoid cross-linking with
// the main landing footer and keep this shell focused on legal/resources nav) ──

function PublicFooter({ lang }: { lang: PubLang }) {
  const RESOURCE_LINKS = [
    { label: lang === 'fr' ? 'Documentation' : 'Documentation', href: '/resources/docs' },
    { label: lang === 'fr' ? 'Exemples vidéo' : 'Video examples', href: '/resources/examples' },
    { label: lang === 'fr' ? 'Blog' : 'Blog', href: '/resources/blog' },
    { label: lang === 'fr' ? 'Changelog' : 'Changelog', href: '/resources/changelog' },
    { label: lang === 'fr' ? 'Statut' : 'Status', href: '/resources/status' },
  ]
  const LEGAL_LINKS = [
    { label: lang === 'fr' ? 'Confidentialité' : 'Privacy policy', href: '/legal/privacy' },
    { label: lang === 'fr' ? 'CGU' : 'Terms of service', href: '/legal/terms' },
    { label: lang === 'fr' ? 'Mentions légales' : 'Legal notice', href: '/legal/notice' },
    { label: lang === 'fr' ? 'Contact' : 'Contact', href: '/legal/contact' },
  ]

  return (
    <footer className="bg-card border-t border-border/50 py-12 px-4 sm:px-6 mt-24">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Logo variant="full" size="sm" href="/" />
            <p className="font-body text-sm text-[--text-muted] mt-2 mb-5">
              {lang === 'fr'
                ? 'Du script à la vidéo en 5 minutes.'
                : 'From script to video in 5 minutes.'}
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Social network"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
              {lang === 'fr' ? 'Produit' : 'Product'}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link
                  href="/"
                  className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                >
                  {lang === 'fr' ? 'Accueil' : 'Home'}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                >
                  {lang === 'fr' ? 'Tarifs' : 'Pricing'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
              {lang === 'fr' ? 'Ressources' : 'Resources'}
            </h4>
            <ul className="flex flex-col gap-2.5">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
              {lang === 'fr' ? 'Légal' : 'Legal'}
            </h4>
            <ul className="flex flex-col gap-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-xs text-[--text-muted]">
            © 2026 CLYRO. {lang === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}
          </p>
          <p className="font-mono text-xs text-[--text-muted]">
            {lang === 'fr' ? 'Propulsé par IA · Hébergé en Europe' : 'Powered by AI · Hosted in Europe'}
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────

interface PublicShellProps {
  /** Render function receives the active language. Pages switch copy based on it. */
  children: (lang: PubLang) => ReactNode
}

export function PublicShell({ children }: PublicShellProps) {
  const [lang, setLang] = usePubLang()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader lang={lang} onLangChange={setLang} />
      <main className="flex-1 px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">{children(lang)}</div>
      </main>
      <PublicFooter lang={lang} />
    </div>
  )
}

// ── Common typography helpers ─────────────────────────────────────────────────

export function DocTitle({
  eyebrow,
  title,
  updated,
}: {
  eyebrow?: string
  title: string
  updated?: string
}) {
  return (
    <div className="mb-10 pb-8 border-b border-border/40">
      {eyebrow && (
        <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
        {title}
      </h1>
      {updated && (
        <p className="font-mono text-xs text-[--text-muted] mt-3">{updated}</p>
      )}
    </div>
  )
}

export function DocSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-4">
        {title}
      </h2>
      <div className="font-body text-[15px] leading-relaxed text-[--text-secondary] space-y-4">
        {children}
      </div>
    </section>
  )
}

export function DocPara({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-[--text-muted]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
