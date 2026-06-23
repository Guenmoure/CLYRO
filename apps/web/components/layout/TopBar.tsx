'use client'

/**
 * TopBar — minimal editorial header.
 *
 * Audit 23/06/26 — simplified per stakeholder direction. The previous
 * « Ask AI » pill and NotificationPanel are removed ; the language
 * switcher stays (explicit ask). The page title is replaced by a thin
 * mono uppercase breadcrumb « CLYRO / SECTION / PAGE » matching the
 * editorial sidebar's voice.
 *
 *   Left  : hamburger (mobile only) + editorial breadcrumb
 *   Right : language switcher
 *
 * The command palette is still globally available via Cmd/Ctrl+K
 * (the listener lives in CommandPalette.tsx), so we don't need a
 * dedicated button here.
 */

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { NAV_SECTIONS } from './nav-model'
import type { SidebarUser } from './DashboardShell'

interface TopBarProps {
  onMobileMenuToggle: () => void
  user?: SidebarUser
}

/**
 * Resolve the breadcrumb segments for the current pathname.
 * Returns null for /dashboard (just the brand mark on the masthead) so
 * the topbar stays empty on Home.
 */
function resolveCrumb(pathname: string, t: (k: string) => string): { section: string; page: string } | null {
  if (pathname === '/dashboard' || pathname === '/') return null
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return { section: t(section.labelKey), page: t(item.labelKey) }
      }
    }
  }
  return null
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const { t } = useLanguage()
  const pathname = usePathname()
  const crumb = resolveCrumb(pathname, t)

  return (
    <header
      className="h-12 shrink-0 bg-background border-b border-border px-4 sm:px-10 flex items-center justify-between gap-3 z-20"
    >
      {/* ── Left : hamburger (mobile) + editorial crumb ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-9 h-9 -ml-1.5 rounded-lg hover:bg-muted text-[--text-muted] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
          aria-label={t('tb_openMenu')}
        >
          <Menu size={17} />
        </button>

        {crumb && (
          <nav
            aria-label="Breadcrumb"
            className="hidden sm:flex items-baseline gap-3 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[--text-muted]"
          >
            <span>CLYRO</span>
            <span className="text-[--text-muted]/60">/</span>
            <span className="truncate">{crumb.section}</span>
            <span className="text-[--text-muted]/60">/</span>
            <span className="text-foreground font-medium truncate">{crumb.page}</span>
          </nav>
        )}
      </div>

      {/* ── Right : language switcher (kept per stakeholder direction) ── */}
      <div className="flex items-center gap-2 shrink-0">
        <LanguageSwitcher />
      </div>
    </header>
  )
}
