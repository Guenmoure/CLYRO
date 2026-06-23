'use client'

/**
 * Sidebar — editorial table-of-contents (Vague 1, 23/06/26).
 *
 * Single-column 268px wide. Top : masthead with the CLYRO™ wordmark, a
 * tagline, and an « issue » line (Vol. IV · No. 12). Middle : grouped TOC
 * with section eyebrows + roman-numeral items. Bottom : user chip + cog.
 *
 *   • Logo IS the Home affordance (no Dashboard rail entry).
 *   • Geist + violet kept (per stakeholder direction) — terracotta and
 *     Instrument Serif from the original handoff are NOT applied.
 *   • Eyebrow / folio / numeral primitives live in globals.css.
 *
 * Accessibility :
 *   • Every item is a Link with aria-current="page" when active.
 *   • Section headers are real <h3 className="eyebrow">.
 *   • Focus rings respect WCAG 2.5.5 (40×40 ish on every interactive item).
 *   • User-menu dropdown : aria-haspopup + aria-expanded + Escape to close.
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { getPlanTotal } from '@/components/dashboard/CreditsBanner'
import {
  NAV_SECTIONS, resolveActiveItemId, SIDEBAR_W,
} from './nav-model'
import {
  ChevronUp, LogOut, Settings, Sparkles,
  HelpCircle, ExternalLink, X, Zap,
} from 'lucide-react'
import type { SidebarUser } from './DashboardShell'

// ── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user:          SidebarUser
  /** Unused on the editorial layout — kept for prop compat. */
  projectsCount?: number
  draftsCount?:   number
  /** Editorial sidebar has no collapse — kept for prop compat. */
  collapsed?:    boolean
  onToggle?:     (val: boolean) => void
  mobileOpen:    boolean
  onMobileClose: () => void
}

// Issue line — yearly volume + monthly number. Computed once per mount so it
// stays stable across re-renders and matches the « editorial » feel.
function computeIssueLine(): { vol: string; num: string } {
  const now = new Date()
  const year = now.getFullYear()
  // Volume = years since CLYRO launch (2024) ; gives Vol. III in 2026, Vol. IV in 2027 etc.
  const vol = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][Math.max(0, Math.min(9, year - 2024))]
  const month = now.toLocaleString('en-US', { month: 'short' })
  const num = `${month} ${year} · No. ${String(now.getMonth() + 1).padStart(2, '0')}`
  return { vol: `Vol. ${vol}`, num }
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({
  user,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { t }    = useLanguage()

  const activeId = resolveActiveItemId(pathname)
  const isHome   = pathname === '/dashboard'

  // User menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    function onMouse(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  // Close mobile drawer when route changes
  useEffect(() => { onMobileClose() }, [pathname, onMobileClose])

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onMobileClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  // Sign out
  async function handleSignOut() {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  // Credits
  const creditsTotal = getPlanTotal(user.plan)
  const creditsLabel = t('sb_creditsLeft')
    .replace('{n}', String(user.creditsLeft))
    .replace('{total}', String(creditsTotal))
  const isStarter = ['free', 'starter'].includes(user.plan.toLowerCase())
  const issue = computeIssueLine()

  // ── Masthead (top of the sidebar) ─────────────────────────────────────────
  function Masthead() {
    return (
      <div className="px-6 pb-5 border-b border-border">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          aria-current={isHome ? 'page' : undefined}
          aria-label={t('dashboard')}
          className={cn(
            'block text-left font-display font-bold leading-none tracking-tight',
            'text-foreground hover:opacity-80 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded',
          )}
          style={{ fontSize: 34, letterSpacing: '-0.04em' }}
        >
          CLYRO
          <sup className="font-mono text-[--text-muted] ml-1 tracking-wider" style={{ fontSize: 9 }}>™</sup>
        </button>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[--text-muted]">
          {t('sb_tagline')}
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[--text-muted]">
            {issue.vol}
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {issue.num}
          </span>
        </div>
      </div>
    )
  }

  // ── Table of contents (middle) ───────────────────────────────────────────
  function TableOfContents({ compact = false }: { compact?: boolean }) {
    return (
      <nav aria-label={t('nav_primary')} className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-5">
        {NAV_SECTIONS.map((section, idx) => (
          <div
            key={section.id}
            className={cn(
              'px-6',
              idx > 0 && 'mt-5 pt-4 border-t border-border/40',
              idx < NAV_SECTIONS.length - 1 && 'pb-1',
            )}
          >
            <div className="flex items-baseline justify-between mb-2.5">
              <h3 className="eyebrow">{t(section.labelKey)}</h3>
              <span className="folio">
                {section.items.length.toString().padStart(2, '0')}
              </span>
            </div>
            <ul className="space-y-0">
              {section.items.map((item) => {
                const active = item.id === activeId
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'grid items-baseline transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded',
                        compact ? 'py-1.5' : 'py-1.5',
                      )}
                      style={{ gridTemplateColumns: '28px 1fr', columnGap: 4 }}
                    >
                      <span
                        className={cn(
                          'font-mono tracking-wider',
                          active ? 'text-primary' : 'text-[--text-muted]',
                        )}
                        style={{ fontSize: 9 }}
                      >
                        {item.numeral}
                      </span>
                      <span
                        className={cn(
                          'font-display leading-tight',
                          active ? 'text-foreground font-semibold' : 'text-[--text-secondary] hover:text-foreground',
                        )}
                        style={{ fontSize: 16, letterSpacing: '-0.005em' }}
                      >
                        {t(item.labelKey)}
                        {active && (
                          <span
                            aria-hidden
                            className="inline-block w-1.5 h-1.5 rounded-full bg-primary ml-2 mb-0.5 align-middle"
                          />
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    )
  }

  // ── Foot (user chip + credits + menu) ────────────────────────────────────
  function Foot() {
    return (
      <div ref={userMenuRef} className="relative px-4 pt-3 pb-4 border-t border-border">
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label={user.fullName}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg p-2 transition-colors',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            userMenuOpen && 'bg-muted',
          )}
        >
          <div
            className={cn(
              'w-9 h-9 rounded-full shrink-0 flex items-center justify-center',
              'text-white text-xs font-display font-semibold',
            )}
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--foreground))',
              fontSize: 14,
            }}
          >
            {user.initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-display text-sm font-medium text-foreground truncate leading-tight">
              {user.fullName}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[--text-muted] leading-tight mt-0.5">
              {user.plan} · {user.isUnlimited ? t('cb_unlimited') : `${user.creditsLeft} cr`}
            </p>
          </div>
          <ChevronUp
            size={13}
            className={cn(
              'shrink-0 text-[--text-muted] transition-transform',
              !userMenuOpen && 'rotate-180',
            )}
          />
        </button>

        {userMenuOpen && (
          <div
            role="menu"
            className={cn(
              'absolute bottom-full left-4 right-4 mb-2 z-50',
              'rounded-xl overflow-hidden bg-card border border-border shadow-xl',
            )}
          >
            <div className="px-4 py-3 border-b border-border/60">
              <p className="font-display text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[--text-muted] mt-0.5">
                {user.plan} · {creditsLabel}
              </p>
            </div>
            <div className="py-1.5">
              <UserMenuItem
                icon={Sparkles}
                label={t('userMenu_upgradePlan')}
                href={isStarter ? '/pricing' : '/settings/billing'}
                onClose={() => setUserMenuOpen(false)}
              />
              <UserMenuItem
                icon={Settings}
                label={t('settings')}
                href="/settings"
                onClose={() => setUserMenuOpen(false)}
              />
              <UserMenuItem
                icon={HelpCircle}
                label={t('userMenu_help')}
                href="https://docs.clyro.ai"
                onClose={() => setUserMenuOpen(false)}
                external
              />
            </div>
            <div className="border-t border-border/60 py-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setUserMenuOpen(false); handleSignOut() }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error',
                  'hover:bg-error/10 focus-visible:outline-none focus-visible:bg-error/10',
                  'transition-colors text-left',
                )}
              >
                <LogOut size={14} className="shrink-0 opacity-70" />
                {t('logout')}
              </button>
            </div>
          </div>
        )}

        {/* Credits bar — concise editorial style, full-width under the user chip. */}
        <div className="mt-3 px-1 flex items-center gap-2">
          <Zap
            size={12}
            className={cn(
              user.isUnlimited
                ? 'text-primary'
                : user.creditsLeft <= 0
                  ? 'text-error'
                  : user.creditsLeft < 50
                    ? 'text-warning'
                    : 'text-primary',
            )}
          />
          <span className="font-mono text-[10px] text-[--text-muted] uppercase tracking-[0.1em] flex-1 truncate">
            {user.isUnlimited ? t('cb_unlimited') : creditsLabel}
          </span>
          {!user.isUnlimited && (
            <Link
              href={isStarter ? '/pricing' : '/settings/billing'}
              className="font-mono text-[10px] text-primary uppercase tracking-[0.1em] hover:underline"
            >
              {isStarter ? t('dash_upgrade') : t('dash_topUp')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      className="hidden md:flex flex-col h-full bg-background border-r border-border"
      style={{ width: SIDEBAR_W }}
    >
      <div className="pt-7"><Masthead /></div>
      <TableOfContents />
      <Foot />
    </aside>
  )

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  const mobileDrawer = (
    <aside className="flex flex-col h-full w-[280px] max-w-[85vw] bg-background border-r border-border">
      <div className="flex items-start justify-between px-2 pt-5">
        <div className="flex-1"><Masthead /></div>
        <button
          type="button"
          onClick={onMobileClose}
          aria-label={t('sb_closeSidebar')}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center mr-2',
            'text-[--text-muted] hover:text-foreground hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors',
          )}
        >
          <X size={18} />
        </button>
      </div>
      <TableOfContents compact />
      <Foot />
    </aside>
  )

  return (
    <>
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        {desktopSidebar}
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 h-full">{mobileDrawer}</div>
        </div>
      )}
    </>
  )
}

// ── UserMenuItem ───────────────────────────────────────────────────────────────

function UserMenuItem({
  icon: Icon,
  label,
  href,
  onClose,
  external,
}: {
  icon:      React.ElementType
  label:     string
  href:      string
  onClose:   () => void
  external?: boolean
}) {
  const router = useRouter()
  function handleClick() {
    onClose()
    if (external) {
      window.open(href, '_blank', 'noopener noreferrer')
    } else {
      router.push(href)
    }
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body',
        'text-[--text-secondary] hover:bg-muted',
        'focus-visible:outline-none focus-visible:bg-muted transition-colors text-left',
      )}
    >
      <Icon size={14} className="shrink-0 opacity-60" />
      <span className="flex-1">{label}</span>
      {external && <ExternalLink size={11} className="shrink-0 opacity-40" />}
    </button>
  )
}
