'use client'

/**
 * TopBar — patterns HeyGen.
 *
 *   Gauche  : hamburger (mobile) + titre de la page courante (dérivé du pathname)
 *   Centre  : champ de recherche qui OUVRE la command palette (⌘K)
 *             — devient une icône seule sur mobile
 *   Droite  : bouton primaire « + Créer » (dropdown 5 modules),
 *             notifications, langue, thème, avatar utilisateur
 *
 * La command palette vit dans DashboardShell et s'ouvre sur ⌘K / Ctrl+K :
 * le champ de recherche dispatch un KeyboardEvent synthétique équivalent,
 * ce qui évite de modifier components/shared/command-palette.tsx.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { NotificationPanel } from '@/components/shared/notification-panel'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { NewProjectDropdown } from '@/components/dashboard/NewProjectDropdown'
import type { SidebarUser } from './DashboardShell'

// ── Page title mapping — first path segment → translation key ──────────────────

const SEGMENT_TITLE_KEYS: Record<string, string> = {
  dashboard: 'dashboard',
  faceless:  'facelessVideos',
  motion:    'motionDesign',
  studio:    'aiAvatarStudio',
  brand:     'brandKit',
  autopilot: 'npd_autopilot_title',
  projects:  'projects',
  drafts:    'dr_title',
  templates: 'templates',
  assets:    'assets',
  voices:    'voices',
  analytics: 'anal_title',
  settings:  'settings',
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMobileMenuToggle: () => void
  user?: SidebarUser
}

/** Open the existing CommandPalette (listens for ⌘K / Ctrl+K on window). */
function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
  )
}

export function TopBar({ onMobileMenuToggle, user }: TopBarProps) {
  const { t } = useLanguage()
  const pathname = usePathname()

  const segment  = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'
  const titleKey = SEGMENT_TITLE_KEYS[segment]
  const pageTitle = titleKey ? t(titleKey) : ''

  return (
    <header className="h-14 shrink-0 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 flex items-center justify-between gap-3 z-20">
      {/* ── Left: hamburger (mobile) + page title ── */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-lg hover:bg-muted text-[--text-muted] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
          aria-label={t('tb_openMenu')}
        >
          <Menu size={18} />
        </button>

        {/* <p>, pas <h1> — chaque page possède déjà son propre h1 (règle DESIGN_TOKENS) */}
        {pageTitle && (
          <p className="font-display text-sm font-semibold text-foreground truncate">
            {pageTitle}
          </p>
        )}
      </div>

      {/* ── Right: search + create + utilities + avatar ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Search field — opens the command palette. Icon-only on mobile. */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t('tb_search')}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            'sm:hidden flex items-center justify-center w-10 h-10 rounded-lg',
            'text-[--text-muted] hover:text-foreground hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            'transition-colors',
          )}
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t('tb_search')}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            'hidden sm:flex items-center gap-2 h-9 w-44 md:w-56 px-3 rounded-lg',
            'bg-input border border-border text-left',
            'hover:border-[--border-hover] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <Search size={14} className="shrink-0 text-[--text-muted]" aria-hidden="true" />
          <span className="flex-1 font-body text-sm text-[--text-muted] truncate">
            {t('tb_search')}
          </span>
          <kbd className="shrink-0 font-mono text-[10px] text-[--text-muted] bg-muted border border-border/60 px-1.5 py-0.5 rounded" aria-hidden="true">
            ⌘K
          </kbd>
        </button>

        {/* Ask AI — visual entry point for the future assistant.
            For now it opens the existing command palette (same ⌘K mechanism
            as the search field) so the pill is functional, not a dead button.
            // TODO: brancher l'assistant IA quand disponible */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t('tb_askAI')}
          className={cn(
            'hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full',
            'bg-card border border-border text-sm font-medium font-display text-foreground',
            'hover:border-[--border-hover] hover:bg-muted transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <Sparkles size={14} className="shrink-0 text-primary" aria-hidden="true" />
          {t('tb_askAI')}
        </button>

        {/* Primary "+ Create" dropdown — the 5 modules */}
        <NewProjectDropdown />

        <NotificationPanel />
        <LanguageSwitcher />
        <ThemeToggle />

        {/* User avatar → settings */}
        {user && (
          <Link
            href="/settings"
            aria-label={`${user.fullName} — ${t('settings')}`}
            className={cn(
              'relative w-8 h-8 rounded-full shrink-0 after:absolute after:inset-[-4px]',
              'bg-grad-cta flex items-center justify-center',
              'text-white text-xs font-medium font-display',
              'hover:opacity-90 transition-opacity',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            {user.initials}
          </Link>
        )}
      </div>
    </header>
  )
}
