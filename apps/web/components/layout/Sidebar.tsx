'use client'

/**
 * Sidebar — two-level navigation (HeyGen pattern).
 *
 *   RAIL (≈72px)  : icon + micro-label per top-level section, violet-active.
 *                   User avatar + credits sit at the bottom of the rail.
 *   PANEL (≈210px): contextual sub-menu for the active section — title,
 *                   optional "+ Create new" button, grouped sub-links, plus
 *                   the credits block at the bottom.
 *
 * The panel only appears for sections that have children AND when the user
 * hasn't collapsed it. Home / Autopilot have no children → rail only.
 *
 * `collapsed` (persisted by DashboardShell) now means "panel hidden". The
 * rail stays visible at all times on desktop.
 *
 * Mobile: a single drawer renders the rail entries flattened into a
 * hierarchical list (section header → its child links).
 *
 *   • aria-current on active rail / child links
 *   • focus-visible:ring on every interactive element
 *   • the panel is plain nav — it never traps focus
 *   • all visible strings via t() (5 languages)
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { getPlanTotal } from '@/components/dashboard/CreditsBanner'
import { NavRail } from './NavRail'
import { ContextPanel } from './ContextPanel'
import {
  RAIL_ITEMS, RAIL_BOTTOM_ITEMS, resolveActiveEntry, resolveActiveChildHref,
  RAIL_W, PANEL_W, type NavEntry,
} from './nav-model'
import {
  ChevronUp, PanelLeftClose, PanelLeftOpen,
  HelpCircle, Bell, LogOut, Settings,
  CreditCard, ExternalLink, X, Zap, Plus,
} from 'lucide-react'
import type { SidebarUser } from './DashboardShell'

// ── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user:          SidebarUser
  projectsCount: number
  draftsCount:   number
  /** Panel hidden when true (rail stays visible). Persisted by the shell. */
  collapsed:     boolean
  onToggle:      (val: boolean) => void
  mobileOpen:    boolean
  onMobileClose: () => void
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({
  user,
  projectsCount,
  draftsCount,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { t }    = useLanguage()

  // ── Active section (driven by pathname) ──────────────────────────────────────
  const activeEntry = resolveActiveEntry(pathname) ?? RAIL_ITEMS[0]
  const activeId    = activeEntry.id
  const hasPanel    = (activeEntry.children?.length ?? 0) > 0

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
  useEffect(() => {
    onMobileClose()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  // ── Rail navigation: navigate + ensure the panel is shown ────────────────────
  function handleRailSelect(entry: NavEntry) {
    if ((entry.children?.length ?? 0) > 0 && collapsed) onToggle(false)
    router.push(entry.href)
  }

  // ── Sign out ─────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  // ── Credits ──────────────────────────────────────────────────────────────────
  const creditsTotal = getPlanTotal(user.plan)
  const creditsPct    = creditsTotal > 0
    ? Math.max(0, Math.min(100, Math.round((user.creditsLeft / creditsTotal) * 100)))
    : 0
  const creditsEmpty = user.creditsLeft <= 0
  const creditsLow   = !creditsEmpty && user.creditsLeft < 50
  const isStarter    = ['free', 'starter'].includes(user.plan.toLowerCase())
  const creditsLabel = t('sb_creditsLeft')
    .replace('{n}', String(user.creditsLeft))
    .replace('{total}', String(creditsTotal))

  // Whether the panel column is rendered on desktop.
  const panelOpen = hasPanel && !collapsed

  // ── Credits block (full) — shown in panel & mobile ──────────────────────────
  const creditsBlock = (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <Zap size={13} className={cn(
            'shrink-0',
            creditsEmpty ? 'text-error' : creditsLow ? 'text-warning' : 'text-primary',
          )} aria-hidden="true" />
          <span className="font-mono text-[11px] text-[--text-secondary] truncate">
            {creditsLabel}
          </span>
        </span>
        <Link
          href={isStarter ? '/pricing' : '/settings/billing'}
          className={cn(
            'shrink-0 font-display text-[11px] font-medium text-primary',
            'hover:underline rounded',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          {isStarter ? t('dash_upgrade') : t('dash_topUp')}
        </Link>
      </div>
      <div
        role="progressbar"
        aria-label={creditsLabel}
        aria-valuemin={0}
        aria-valuemax={creditsTotal}
        aria-valuenow={Math.max(0, Math.min(user.creditsLeft, creditsTotal))}
        className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            creditsEmpty ? 'bg-error' : creditsLow ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${creditsPct}%` }}
        />
      </div>
    </div>
  )

  // ── Credits icon (rail, collapsed) — tooltip on hover ────────────────────────
  const creditsRailIcon = (
    <div className="relative group flex justify-center">
      <Link
        href={isStarter ? '/pricing' : '/settings/billing'}
        aria-label={creditsLabel}
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center',
          'text-[--text-muted] hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          'transition-colors',
        )}
      >
        <Zap size={16} className={cn(
          creditsEmpty ? 'text-error' : creditsLow ? 'text-warning' : 'text-primary',
        )} />
      </Link>
      <div className={cn(
        'absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50',
        'pointer-events-none whitespace-nowrap',
        'px-2.5 py-1.5 rounded-lg text-xs font-medium',
        'bg-foreground text-background shadow-lg',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
      )}>
        {creditsLabel}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
      </div>
    </div>
  )

  // ── User avatar trigger + dropdown (shared) ──────────────────────────────────
  function userMenu(compact: boolean) {
    return (
      <div ref={userMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label={compact ? user.fullName : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl transition-colors duration-150',
            'hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            userMenuOpen && 'bg-muted',
            compact ? 'justify-center p-1.5' : 'p-2.5',
          )}
        >
          <div className="w-8 h-8 rounded-full shrink-0 bg-grad-cta flex items-center justify-center text-white text-xs font-medium font-display">
            {user.initials}
          </div>
          {!compact && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display text-sm font-medium text-foreground truncate leading-tight">
                  {user.fullName}
                </p>
                <p className="font-mono text-[11px] text-[--text-muted] leading-tight">
                  {user.plan}
                  <span className="text-primary ml-1">· {user.creditsLeft} cr</span>
                </p>
              </div>
              <ChevronUp size={13} className={cn(
                'shrink-0 text-[--text-muted] transition-transform duration-150',
                !userMenuOpen && 'rotate-180',
              )} />
            </>
          )}
        </button>

        {userMenuOpen && (
          <div
            role="menu"
            className={cn(
              'absolute bottom-full mb-2 z-50 rounded-2xl overflow-hidden',
              'bg-card border border-border shadow-xl',
              compact ? 'left-full ml-2 w-56' : 'left-0 right-0',
            )}
          >
            <div className="px-4 py-3 border-b border-border/60">
              <p className="font-display text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
              <p className="font-mono text-xs text-[--text-muted] mt-0.5">
                {user.plan} · {creditsLabel}
              </p>
            </div>
            <div className="py-1.5">
              <UserMenuItem icon={Settings}     label={t('settings')}       href="/settings" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={CreditCard}   label={t('billing')}        href="/settings/billing" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={Bell}         label={t('sb_updates')}     href="/dashboard" onClose={() => setUserMenuOpen(false)} badge="2" />
              <UserMenuItem icon={HelpCircle}   label={t('sb_helpSupport')} href="/dashboard" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={ExternalLink} label={t('sb_docs')}        href="https://docs.clyro.ai" onClose={() => setUserMenuOpen(false)} external />
            </div>
            <div className="border-t border-border/60 py-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setUserMenuOpen(false); handleSignOut() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error hover:bg-error/10 focus-visible:outline-none focus-visible:bg-error/10 transition-colors text-left"
              >
                <LogOut size={14} className="shrink-0 opacity-70" />
                {t('logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP — rail + optional panel ──────────────────────────────────────────
  const desktopSidebar = (
    <div className="hidden md:flex h-full bg-card border-r border-border/50">

      {/* ── RAIL ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col h-full shrink-0 py-3"
        style={{ width: RAIL_W }}
      >
        {/* Logo → /dashboard */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-3 flex justify-center hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
          aria-label={t('dashboard')}
        >
          <Logo variant="icon" size="md" />
        </button>

        {/* Top rail items */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <NavRail items={RAIL_ITEMS} activeId={activeId} onSelect={handleRailSelect} />
        </div>

        {/* Bottom: settings, credits icon (when panel hidden), avatar */}
        <div className="shrink-0 pt-2 space-y-1.5">
          <NavRail items={RAIL_BOTTOM_ITEMS} activeId={activeId} onSelect={handleRailSelect} />
          {!panelOpen && creditsRailIcon}
          <div className="px-1.5">{userMenu(true)}</div>
        </div>
      </div>

      {/* ── PANEL — contextual sub-menu ──────────────────────────── */}
      {panelOpen && (
        <div
          className="flex flex-col h-full shrink-0 border-l border-border/50 bg-background/60"
          style={{ width: PANEL_W }}
        >
          {/* Header: collapse toggle */}
          <div className="flex items-center justify-end px-3 pt-3">
            <button
              type="button"
              onClick={() => onToggle(true)}
              aria-label={t('sb_collapsePanel')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>
          </div>

          {/* Sub-menu */}
          <div className="flex-1 min-h-0">
            <ContextPanel entry={activeEntry} />
          </div>

          {/* Credits block at panel bottom */}
          <div className="shrink-0 px-3 pb-3">{creditsBlock}</div>
        </div>
      )}

      {/* When a panel exists but is collapsed, offer a reopen affordance */}
      {hasPanel && collapsed && (
        <button
          type="button"
          onClick={() => onToggle(false)}
          aria-label={t('sb_expandPanel')}
          className="self-start mt-3 -ml-3 w-6 h-6 rounded-full flex items-center justify-center border border-border bg-card text-[--text-muted] hover:bg-muted hover:text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors z-10"
        >
          <PanelLeftOpen size={12} />
        </button>
      )}
    </div>
  )

  // ── MOBILE — flattened hierarchical drawer ───────────────────────────────────
  const mobileDrawer = (
    <aside className="flex flex-col h-full w-[280px] max-w-[85vw] bg-card border-r border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
          aria-label={t('dashboard')}
        >
          <Logo variant="full" size="md" />
        </button>
        <button
          type="button"
          onClick={onMobileClose}
          aria-label={t('sb_closeSidebar')}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Flattened nav */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-1 space-y-4">
        {[...RAIL_ITEMS, ...RAIL_BOTTOM_ITEMS].map((entry) => {
          const Icon = entry.icon
          const sectionActive = entry.id === activeId
          const activeChildHref = resolveActiveChildHref(entry, pathname)
          return (
            <div key={entry.id}>
              {/* Section header → navigates to entry root */}
              <Link
                href={entry.href}
                aria-current={sectionActive && !entry.children ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2 h-9 rounded-lg text-sm font-display font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  sectionActive ? 'text-foreground' : 'text-[--text-secondary] hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon size={17} strokeWidth={1.8} className={cn('shrink-0', sectionActive ? 'text-primary' : 'text-[--text-muted]')} aria-hidden="true" />
                {t(entry.labelKey)}
              </Link>

              {/* Children */}
              {entry.children && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-border/60 space-y-0.5">
                  {entry.isModule && (
                    <Link
                      href={`${entry.href}/new`}
                      className="flex items-center gap-1.5 h-8 px-2 rounded-lg text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
                    >
                      <Plus size={13} aria-hidden="true" />
                      {t('nav_createNew')}
                    </Link>
                  )}
                  {entry.children.map((child) => {
                    const active = child.href === activeChildHref
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center h-8 px-2 rounded-lg text-sm font-body transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          active ? 'bg-accent text-accent-foreground font-medium' : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {t(child.labelKey)}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Credits + user */}
      <div className="shrink-0 border-t border-border/60 p-3 space-y-3">
        {creditsBlock}
        {userMenu(false)}
      </div>
    </aside>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop — fixed */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        {desktopSidebar}
      </div>

      {/* Mobile overlay + drawer */}
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
  badge,
  external,
}: {
  icon:      React.ElementType
  label:     string
  href:      string
  onClose:   () => void
  badge?:    string
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
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-[--text-secondary] hover:bg-muted focus-visible:outline-none focus-visible:bg-muted transition-colors text-left"
    >
      <Icon size={14} className="shrink-0 opacity-60" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
          {badge}
        </span>
      )}
      {external && <ExternalLink size={11} className="shrink-0 opacity-40" />}
    </button>
  )
}
