'use client'

/**
 * Sidebar — navigation principale du dashboard.
 *
 * Deux groupes de navigation :
 *   CRÉER     → Avatar Studio, Faceless Videos, Motion Design, Brand Kit
 *   WORKSPACE → Projets (avec compteur), Assets
 *
 * Fonctionnalités :
 *   • Mode collapsed (72px) / expanded (240px) — toggle + localStorage
 *   • Logo CLYRO cliquable → /dashboard
 *   • Tooltips en mode collapsed (hover)
 *   • Compteur sur "Projets" (ambre si drafts existent)
 *   • User card bas de page : avatar + nom + plan + crédits
 *   • Menu déroulant : Paramètres, Facturation, Updates, Aide, Déconnexion
 *   • Support light / dark mode via CSS variables
 *   • Mobile drawer (géré par le parent DashboardShell)
 */

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { createBrowserClient } from '@/lib/supabase'
import {
  Film, Video, Sparkles, Palette,
  FolderOpen, Package,
  ChevronLeft, ChevronRight, ChevronUp,
  Settings, HelpCircle, Bell, LogOut,
  CreditCard, ExternalLink, X,
} from 'lucide-react'
import type { SidebarUser } from './DashboardShell'

// ── Nav structure ──────────────────────────────────────────────────────────────

const CREATE_ITEMS = [
  { id: 'studio',   icon: Film,     label: 'Avatar Studio',   href: '/studio' },
  { id: 'faceless', icon: Video,    label: 'Faceless Videos', href: '/faceless' },
  { id: 'motion',   icon: Sparkles, label: 'Motion Design',   href: '/motion' },
  { id: 'brand',    icon: Palette,  label: 'Brand Kit',       href: '/brand' },
]

const WORKSPACE_ITEMS = [
  { id: 'projects', icon: FolderOpen, label: 'Projects', href: '/projects' },
  { id: 'assets',   icon: Package,    label: 'Assets',   href: '/assets' },
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

  // User menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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

  // ── Sidebar inner (shared between desktop and mobile drawer) ───────────────

  const sidebarInner = (
    <aside className={cn(
      'flex flex-col h-full',
      'bg-card border-r border-border/50',
      'transition-[width] duration-300 ease-in-out overflow-hidden',
      collapsed && !mobileOpen ? 'w-[72px]' : 'w-[240px]',
    )}>

      {/* ── HEADER — Logo + collapse toggle ────────────────────── */}
      <div className={cn(
        'flex items-center px-4 pt-5 pb-3 shrink-0',
        collapsed && !mobileOpen ? 'justify-center' : 'justify-between',
      )}>
        {/* Logo → /dashboard */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
          aria-label="Go to dashboard"
        >
          {collapsed && !mobileOpen
            ? <Logo variant="icon" size="sm" />
            : <Logo variant="full" size="sm" />
          }
        </button>

        {/* Collapse toggle — desktop only */}
        {!mobileOpen && (
          <button
            type="button"
            onClick={() => onToggle(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
              'border border-border bg-card text-[--text-muted]',
              'hover:bg-muted hover:text-foreground',
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
            aria-label="Close sidebar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── SECTION — CRÉER ─────────────────────────────────────── */}
      <div className="mt-2 px-3 shrink-0">
        {(!collapsed || mobileOpen) && (
          <p className="px-2 mb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest text-[--text-muted]">
            Create
          </p>
        )}
        <nav className="space-y-0.5">
          {CREATE_ITEMS.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed && !mobileOpen}
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>
      </div>

      {/* ── DIVIDER ─────────────────────────────────────────────── */}
      <div className={cn(
        'my-3 h-px bg-border/60 shrink-0',
        collapsed && !mobileOpen ? 'mx-4' : 'mx-3',
      )} />

      {/* ── SECTION — WORKSPACE ─────────────────────────────────── */}
      <div className="px-3 shrink-0">
        {(!collapsed || mobileOpen) && (
          <p className="px-2 mb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest text-[--text-muted]">
            Workspace
          </p>
        )}
        <nav className="space-y-0.5">
          {WORKSPACE_ITEMS.map(item => {
            const count      = item.id === 'projects' ? projectsCount : undefined
            const countColor = item.id === 'projects' && draftsCount > 0 ? 'amber' : 'default'
            return (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href)}
                collapsed={collapsed && !mobileOpen}
                count={count}
                countColor={countColor}
                onClick={() => router.push(item.href)}
              />
            )
          })}
        </nav>
      </div>

      {/* ── SPACER ──────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── DIVIDER BOTTOM ──────────────────────────────────────── */}
      <div className={cn(
        'h-px bg-border/60 shrink-0',
        collapsed && !mobileOpen ? 'mx-4' : 'mx-3',
      )} />

      {/* ── USER CARD + DROPDOWN ────────────────────────────────── */}
      <div ref={userMenuRef} className="relative p-3 shrink-0">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setUserMenuOpen(v => !v)}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl p-2.5 transition-colors duration-150',
            'hover:bg-muted',
            userMenuOpen && 'bg-muted',
            collapsed && !mobileOpen && 'justify-center',
          )}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium font-display">
            {user.initials}
          </div>

          {(!collapsed || mobileOpen) && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display text-sm font-medium text-foreground truncate leading-tight">
                  {user.fullName}
                </p>
                <p className="font-mono text-[11px] text-[--text-muted] leading-tight">
                  {user.plan}
                  <span className="text-blue-400 ml-1">· {user.creditsLeft} cr</span>
                </p>
              </div>
              <ChevronUp size={13} className={cn(
                'shrink-0 text-[--text-muted] transition-transform duration-150',
                !userMenuOpen && 'rotate-180',
              )} />
            </>
          )}
        </button>

        {/* Tooltip collapsed mode */}
        {(collapsed && !mobileOpen) && (
          <div className="absolute left-full bottom-3 ml-3 z-50 pointer-events-none opacity-0 group-hover:opacity-100">
            {/* handled via group in NavItem pattern below */}
          </div>
        )}

        {/* ── Dropdown menu ── */}
        {userMenuOpen && (
          <div className={cn(
            'absolute bottom-full mb-2 z-50 rounded-2xl overflow-hidden',
            'bg-card border border-border shadow-xl',
            collapsed && !mobileOpen
              ? 'left-full ml-2 w-56'
              : 'left-3 right-3',
          )}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/60">
              <p className="font-display text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
              <p className="font-mono text-xs text-[--text-muted] mt-0.5">
                {user.plan} · {user.creditsLeft} credits remaining
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <UserMenuItem icon={Settings}     label="Settings"       href="/settings" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={CreditCard}   label="Billing"        href="/settings" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={Bell}         label="Updates"        href="/dashboard" onClose={() => setUserMenuOpen(false)} badge="2" />
              <UserMenuItem icon={HelpCircle}   label="Help & Support" href="/dashboard" onClose={() => setUserMenuOpen(false)} />
              <UserMenuItem icon={ExternalLink} label="Documentation"  href="https://docs.clyro.ai" onClose={() => setUserMenuOpen(false)} external />
            </div>

            {/* Sign out */}
            <div className="border-t border-border/60 py-1.5">
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); handleSignOut() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error hover:bg-error/10 transition-colors text-left"
              >
                <LogOut size={14} className="shrink-0 opacity-70" />
                Sign out
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
        className={cn(
          'w-full flex items-center gap-3 rounded-xl transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
          collapsed ? 'justify-center h-10 px-0' : 'px-3 h-10',
          active
            ? cn(
                'bg-blue-500/10 text-blue-500 dark:text-blue-400',
                !collapsed && 'border-l-2 border-blue-500 rounded-l-none pl-[10px]',
              )
            : 'text-[--text-secondary] hover:bg-muted hover:text-foreground border-l-2 border-transparent',
        )}
      >
        <Icon
          size={18}
          className={cn(
            'shrink-0 transition-colors',
            active ? 'text-blue-500 dark:text-blue-400' : 'text-[--text-muted] group-hover:text-foreground',
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
                  ? 'bg-amber-500/15 text-amber-500'
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
          countColor === 'amber' ? 'bg-amber-500' : 'bg-blue-500',
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
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body text-[--text-secondary] hover:bg-muted transition-colors text-left"
    >
      <Icon size={14} className="shrink-0 opacity-60" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
          {badge}
        </span>
      )}
      {external && <ExternalLink size={11} className="shrink-0 opacity-40" />}
    </button>
  )
}
