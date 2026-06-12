'use client'

/**
 * Sidebar — navigation principale du dashboard (patterns HeyGen).
 *
 * Trois groupes de navigation :
 *   CRÉER        → Faceless, Motion, Avatar Studio, Brand Kit, Autopilot
 *   BIBLIOTHÈQUE → Projets (compteur), Brouillons, Templates, Assets, Voix
 *   ESPACE       → Analytics, Réglages
 *
 * Fonctionnalités :
 *   • Mode collapsed (72px) / expanded (240px) — toggle + localStorage
 *   • Logo CLYRO cliquable → /dashboard
 *   • Tooltips en mode collapsed (hover)
 *   • Compteur sur "Projets" + compteur ambre sur "Brouillons"
 *   • Bloc crédits bas de sidebar : barre de progression + Upgrade discret
 *   • User card bas de page : avatar + nom + plan + crédits
 *   • Menu déroulant : Paramètres, Facturation, Updates, Aide, Déconnexion
 *   • Support light / dark mode via CSS variables
 *   • Mobile drawer (géré par le parent DashboardShell)
 *   • Toutes les chaînes visibles passent par t() (5 langues)
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { getPlanTotal } from '@/components/dashboard/CreditsBanner'
import {
  Video, Sparkles, Clapperboard, Palette, Rocket,
  FolderOpen, FileText, LayoutGrid, Package, Mic2,
  BarChart3, Settings,
  ChevronLeft, ChevronRight, ChevronUp,
  HelpCircle, Bell, LogOut,
  CreditCard, ExternalLink, X, Zap,
} from 'lucide-react'
import type { SidebarUser } from './DashboardShell'

// ── Nav structure — labels are translation keys ────────────────────────────────

interface NavEntry {
  id:       string
  icon:     React.ElementType
  labelKey: string
  href:     string
}

const CREATE_ITEMS: NavEntry[] = [
  { id: 'faceless',  icon: Video,        labelKey: 'facelessVideos', href: '/faceless' },
  { id: 'motion',    icon: Sparkles,     labelKey: 'motionDesign',   href: '/motion' },
  { id: 'studio',    icon: Clapperboard, labelKey: 'aiAvatarStudio', href: '/studio' },
  { id: 'brand',     icon: Palette,      labelKey: 'brandKit',       href: '/brand' },
  { id: 'autopilot', icon: Rocket,       labelKey: 'npd_autopilot_title', href: '/autopilot' },
]

const LIBRARY_ITEMS: NavEntry[] = [
  { id: 'projects',  icon: FolderOpen, labelKey: 'projects',  href: '/projects' },
  { id: 'drafts',    icon: FileText,   labelKey: 'dr_title',  href: '/drafts' },
  { id: 'templates', icon: LayoutGrid, labelKey: 'templates', href: '/templates' },
  { id: 'assets',    icon: Package,    labelKey: 'assets',    href: '/assets' },
  { id: 'voices',    icon: Mic2,       labelKey: 'voices',    href: '/voices' },
]

const WORKSPACE_ITEMS: NavEntry[] = [
  { id: 'analytics', icon: BarChart3, labelKey: 'anal_title', href: '/analytics' },
  { id: 'settings',  icon: Settings,  labelKey: 'settings',   href: '/settings' },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user:          SidebarUser
  projectsCount: number
  draftsCount:   number
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

  // ── Path matching ──────────────────────────────────────────────────────────

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function handleSignOut() {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  // ── Credits ────────────────────────────────────────────────────────────────

  const isCollapsedView = collapsed && !mobileOpen
  const creditsTotal    = getPlanTotal(user.plan)
  const creditsPct      = creditsTotal > 0
    ? Math.max(0, Math.min(100, Math.round((user.creditsLeft / creditsTotal) * 100)))
    : 0
  const creditsEmpty = user.creditsLeft <= 0
  const creditsLow   = !creditsEmpty && user.creditsLeft < 50
  const isStarter    = ['free', 'starter'].includes(user.plan.toLowerCase())
  const creditsLabel = t('sb_creditsLeft')
    .replace('{n}', String(user.creditsLeft))
    .replace('{total}', String(creditsTotal))

  // ── Nav group renderer ─────────────────────────────────────────────────────

  function renderGroup(titleKey: string, items: NavEntry[]) {
    return (
      <div className="px-3 shrink-0">
        {!isCollapsedView && (
          <p className="px-2 mb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest text-[--text-muted]">
            {t(titleKey)}
          </p>
        )}
        <nav aria-label={t(titleKey)} className="space-y-0.5">
          {items.map(item => {
            const count =
              item.id === 'projects' ? projectsCount
              : item.id === 'drafts' ? draftsCount
              : undefined
            return (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={t(item.labelKey)}
                active={isActive(item.href)}
                collapsed={isCollapsedView}
                count={count}
                countColor={item.id === 'drafts' && draftsCount > 0 ? 'amber' : 'default'}
                onClick={() => router.push(item.href)}
              />
            )
          })}
        </nav>
      </div>
    )
  }

  // ── Sidebar inner (shared between desktop and mobile drawer) ───────────────

  const sidebarInner = (
    <aside className={cn(
      'flex flex-col h-full',
      'bg-card border-r border-border/50',
      'transition-[width] duration-300 ease-in-out overflow-hidden',
      isCollapsedView ? 'w-[72px]' : 'w-[240px]',
    )}>

      {/* ── HEADER — Logo + collapse toggle ────────────────────── */}
      <div className={cn(
        'flex items-center px-4 pt-5 pb-3 shrink-0',
        isCollapsedView ? 'justify-center' : 'justify-between',
      )}>
        {/* Logo → /dashboard */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
          aria-label={t('dashboard')}
        >
          {isCollapsedView
            ? <Logo variant="icon" size="md" />
            : <Logo variant="full" size="md" />
          }
        </button>

        {/* Collapse toggle — desktop only */}
        {!mobileOpen && (
          <button
            type="button"
            onClick={() => onToggle(!collapsed)}
            aria-label={collapsed ? t('sb_expandSidebar') : t('sb_collapseSidebar')}
            aria-expanded={!collapsed}
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
              'border border-border bg-card text-[--text-muted]',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              'transition-all duration-150 shadow-sm',
              collapsed && 'ml-0',
            )}
          >
            {collapsed
              ? <ChevronRight size={12} />
              : <ChevronLeft  size={12} />
            }
          </button>
        )}

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label={t('sb_closeSidebar')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── SCROLLABLE NAV — Créer / Bibliothèque / Espace ───────── */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1">

        {/* ── SECTION — CRÉER ─────────────────────────────────────── */}
        {renderGroup('sb_create', CREATE_ITEMS)}

        {/* ── DIVIDER ─────────────────────────────────────────────── */}
        <div className={cn(
          'my-3 h-px bg-border/60 shrink-0',
          isCollapsedView ? 'mx-4' : 'mx-3',
        )} />

        {/* ── SECTION — BIBLIOTHÈQUE ──────────────────────────────── */}
        {renderGroup('sidebarLibrary', LIBRARY_ITEMS)}

        {/* ── DIVIDER ─────────────────────────────────────────────── */}
        <div className={cn(
          'my-3 h-px bg-border/60 shrink-0',
          isCollapsedView ? 'mx-4' : 'mx-3',
        )} />

        {/* ── SECTION — ESPACE ────────────────────────────────────── */}
        {renderGroup('sidebarWorkspace', WORKSPACE_ITEMS)}
      </div>

      {/* ── CREDITS BLOCK — progress + upgrade ──────────────────── */}
      <div className="px-3 pb-1 shrink-0">
        {isCollapsedView ? (
          <div className="relative group">
            <Link
              href={isStarter ? '/pricing' : '/settings/billing'}
              aria-label={creditsLabel}
              className={cn(
                'w-10 h-10 mx-auto rounded-xl flex items-center justify-center',
                'text-[--text-muted] hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                'transition-colors',
              )}
            >
              <Zap size={16} className={cn(
                creditsEmpty ? 'text-error' : creditsLow ? 'text-warning' : 'text-primary',
              )} />
            </Link>
            {/* Tooltip — collapsed mode */}
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
        ) : (
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
            {/* Progress — credits remaining */}
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
        )}
      </div>

      {/* ── USER CARD + DROPDOWN ────────────────────────────────── */}
      <div ref={userMenuRef} className="relative p-3 pt-2 shrink-0 border-t border-border/60 mt-2">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setUserMenuOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label={isCollapsedView ? user.fullName : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl p-2.5 transition-colors duration-150',
            'hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            userMenuOpen && 'bg-muted',
            isCollapsedView && 'justify-center',
          )}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full shrink-0 bg-grad-cta flex items-center justify-center text-white text-xs font-medium font-display">
            {user.initials}
          </div>

          {!isCollapsedView && (
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

        {/* ── Dropdown menu ── */}
        {userMenuOpen && (
          <div
            role="menu"
            className={cn(
              'absolute bottom-full mb-2 z-50 rounded-2xl overflow-hidden',
              'bg-card border border-border shadow-xl',
              isCollapsedView
                ? 'left-full ml-2 w-56'
                : 'left-3 right-3',
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/60">
              <p className="font-display text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
              <p className="font-mono text-xs text-[--text-muted] mt-0.5">
                {user.plan} · {creditsLabel}
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <UserMenuItem icon={Settings}     label={t('settings')}      href="/settings" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={CreditCard}   label={t('billing')}       href="/settings/billing" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={Bell}         label={t('sb_updates')}    href="/dashboard" onClose={() => setUserMenuOpen(false)} badge="2" />
              <UserMenuItem icon={HelpCircle}   label={t('sb_helpSupport')} href="/dashboard" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={ExternalLink} label={t('sb_docs')}       href="https://docs.clyro.ai" onClose={() => setUserMenuOpen(false)} external />
            </div>

            {/* Sign out */}
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
    </aside>
  )

  // ── Desktop — fixed sidebar ────────────────────────────────────────────────

  return (
    <>
      {/* Desktop sidebar — fixed, hidden on mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        {sidebarInner}
      </div>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full">
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  )
}

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  count,
  countColor = 'default',
  onClick,
}: {
  icon:        React.ElementType
  label:       string
  active:      boolean
  collapsed:   boolean
  count?:      number
  countColor?: 'default' | 'amber'
  onClick:     () => void
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          collapsed ? 'justify-center h-10 px-0' : 'px-3 h-10',
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon
          size={18}
          className={cn(
            'shrink-0 transition-colors',
            active ? 'text-accent-foreground' : 'text-[--text-muted] group-hover:text-foreground',
          )}
        />
        {!collapsed && (
          <>
            <span className={cn(
              'flex-1 text-left font-body text-sm transition-colors truncate',
              active ? 'font-medium' : 'group-hover:text-foreground',
            )}>
              {label}
            </span>
            {count !== undefined && count > 0 && (
              <span className={cn(
                'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full shrink-0',
                countColor === 'amber'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-muted text-[--text-muted]',
              )}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </>
        )}
      </button>

      {/* Tooltip — collapsed mode only */}
      {collapsed && (
        <div className={cn(
          'absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50',
          'pointer-events-none whitespace-nowrap',
          'px-2.5 py-1.5 rounded-lg text-xs font-medium',
          'bg-foreground text-background shadow-lg',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        )}>
          {label}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 font-mono text-[10px] bg-white/20 px-1 py-0.5 rounded">
              {count}
            </span>
          )}
          {/* Arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
        </div>
      )}

      {/* Badge (count) in collapsed mode */}
      {collapsed && count !== undefined && count > 0 && (
        <span className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full',
          'text-[8px] font-mono font-bold text-white',
          'flex items-center justify-center',
          countColor === 'amber' ? 'bg-warning' : 'bg-primary',
        )}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
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
