'use client'

/**
 * TopBar — minimal header (HeyGen pattern).
 *
 *   Left  : hamburger (mobile only) + page title
 *   Right : language switcher, Ask AI pill, notifications
 *
 * Streamlined to match HeyGen's minimal top bar. The "+ Create" dropdown
 * moved to the sidebar panels and dashboard tiles; theme toggle is in Settings.
 */

import { usePathname } from 'next/navigation'
import { Menu, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { NotificationPanel } from '@/components/shared/notification-panel'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
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

/** Open the existing CommandPalette (listens for Cmd+K / Ctrl+K on window). */
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

        {pageTitle && (
          <p className="font-display text-sm font-semibold text-foreground truncate">
            {pageTitle}
          </p>
        )}
      </div>

      {/* ── Right: language + Ask AI + notifications ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LanguageSwitcher />

        {/* Ask AI — HeyGen-style pill */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t('tb_askAI')}
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 rounded-full',
            'bg-card border border-border text-sm font-medium font-display text-foreground',
            'hover:border-[--border-hover] hover:bg-muted transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <Sparkles size={14} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline">{t('tb_askAI')}</span>
        </button>

        <NotificationPanel />
      </div>
    </header>
  )
}
