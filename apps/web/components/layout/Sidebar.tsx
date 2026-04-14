'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Zap, LayoutGrid, Video, Sparkles, Palette, History, Mic,
  Settings, HelpCircle, ChevronRight, LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  full_name: string | null
  plan: string
  credits: number
}

interface SidebarProps {
  collapsed: boolean
  onToggle: (val: boolean) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

// ── Nav structure ──────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard',      icon: LayoutGrid, exact: true },
      { href: '/faceless',  label: 'Faceless Videos',icon: Video },
      { href: '/motion',    label: 'Motion Design',  icon: Sparkles },
      { href: '/brand',     label: 'Brand Kit',      icon: Palette },
      { href: '/projects',  label: 'Historique',     icon: History },
      { href: '/voices',    label: 'Mes voix',       icon: Mic },
    ],
  },
  {
    label: 'Compte',
    items: [
      { href: '/settings',           label: 'Paramètres', icon: Settings },
      { href: 'mailto:support@clyro.app', label: 'Aide', icon: HelpCircle, external: true },
    ],
  },
]

// ── Tooltip helper ─────────────────────────────────────────────────────────────

function NavTooltip({ label }: { label: string }) {
  return (
    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      <div className="bg-muted border border-border text-foreground font-mono text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-card">
        {label}
      </div>
    </div>
  )
}

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  exact = false,
  external = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  collapsed: boolean
  exact?: boolean
  external?: boolean
}) {
  const pathname = usePathname()
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  const baseClass = cn(
    'relative group flex items-center gap-3 rounded-xl transition-colors duration-150 w-full',
    collapsed ? 'h-10 justify-center px-0' : 'h-10 px-3',
    isActive
      ? 'bg-blue-500/15 border-l-2 border-blue-500 text-foreground pl-[10px]'
      : 'text-[--text-secondary] hover:bg-muted hover:text-foreground border-l-2 border-transparent'
  )

  const inner = (
    <>
      <Icon
        size={18}
        className={cn('shrink-0 transition-colors', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[--text-secondary] group-hover:text-foreground')}
      />
      {!collapsed && (
        <span className="font-body text-sm truncate">{label}</span>
      )}
      {collapsed && <NavTooltip label={label} />}
    </>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={baseClass}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} className={baseClass}>
      {inner}
    </Link>
  )
}

// ── UserCard ───────────────────────────────────────────────────────────────────

function UserCard({ collapsed, onSignOut }: { collapsed: boolean; onSignOut: () => void }) {
  const supabase = createBrowserClient()
  const [name, setName]       = useState<string | null>(null)
  const [email, setEmail]     = useState<string>('')
  const [plan, setPlan]       = useState<string>('free')
  const [initials, setInitials] = useState('?')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name, plan')
        .eq('id', session.user.id)
        .single()
      if (data) {
        const n = data.full_name ?? session.user.email?.split('@')[0] ?? 'User'
        setName(n)
        setPlan(data.plan ?? 'free')
        setInitials(n.charAt(0).toUpperCase())
      }
    }
    load()
  }, [supabase])

  const planBadge = plan === 'pro' || plan === 'studio'
    ? <Badge variant="purple">{plan === 'studio' ? 'Studio' : 'Pro'}</Badge>
    : <Badge variant="neutral">Starter</Badge>

  return (
    <div className={cn(
      'relative group border-t border-border/50 mt-auto pt-3',
      collapsed ? 'px-2' : 'px-3',
    )}>
      <div className={cn(
        'flex items-center gap-3 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer',
        collapsed ? 'justify-center px-0' : 'px-2',
      )}>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-grad-primary flex items-center justify-center shrink-0">
          <span className="font-mono text-xs font-bold text-white">{initials}</span>
        </div>
        {/* Info (only expanded) */}
        {!collapsed && name && (
          <div className="min-w-0 flex-1">
            <p className="font-body text-sm text-foreground truncate leading-none mb-0.5">{name}</p>
            {planBadge}
          </div>
        )}
        {/* Sign out (only expanded) */}
        {!collapsed && (
          <button
            type="button"
            onClick={onSignOut}
            title="Déconnexion"
            className="shrink-0 text-[--text-muted] hover:text-error transition-colors"
          >
            <LogOut size={14} />
          </button>
        )}
        {/* Tooltip in collapsed mode */}
        {collapsed && (
          <NavTooltip label={name ?? email.split('@')[0] ?? 'Compte'} />
        )}
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full z-40',
          'bg-card border-r border-border/50',
          'flex flex-col',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-60',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-14 border-b border-border/50 shrink-0 relative',
          collapsed ? 'justify-center px-0' : 'px-5',
        )}>
          <Link href="/dashboard">
            {collapsed
              ? <span className="font-display font-extrabold text-xl gradient-text select-none">C</span>
              : <span className="font-display font-extrabold text-xl gradient-text select-none">CLYRO</span>
            }
          </Link>

          {/* Toggle button */}
          <button
            type="button"
            onClick={() => onToggle(!collapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-muted border border-border rounded-full items-center justify-center shadow-card hover:bg-border transition-colors z-10"
            aria-label={collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
          >
            <ChevronRight
              size={13}
              className={cn('text-[--text-muted] transition-transform duration-300', !collapsed && 'rotate-180')}
            />
          </button>
        </div>

        {/* CTA "Nouveau projet" */}
        <div className={cn('px-2 pt-4 pb-2 shrink-0', collapsed && 'flex justify-center')}>
          <div className="relative group">
            <Link
              href="/faceless/new"
              className={cn(
                'flex items-center gap-3 rounded-xl bg-grad-primary text-white font-display font-semibold text-sm hover:opacity-90 transition-opacity',
                collapsed ? 'w-10 h-10 justify-center' : 'px-3 py-2.5',
              )}
            >
              <Zap size={16} className="shrink-0" />
              {!collapsed && <span>Nouveau projet</span>}
            </Link>
            {collapsed && <NavTooltip label="Nouveau projet" />}
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
              {!collapsed && (
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold px-1 mb-2">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <NavItem key={item.href} collapsed={collapsed} {...item} />
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="shrink-0 pb-4">
          <UserCard collapsed={collapsed} onSignOut={handleSignOut} />
        </div>
      </aside>
    </>
  )
}
