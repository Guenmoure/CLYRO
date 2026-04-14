'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu, Bell, ChevronRight, User, CreditCard, Settings, LogOut, Zap, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotificationPanel } from '@/components/shared/notification-panel'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// ── Breadcrumb map ─────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/faceless':  'Faceless Videos',
  '/motion':    'Motion Design',
  '/brand':     'Brand Kit',
  '/projects':  'Historique',
  '/voices':    'Mes voix',
  '/settings':  'Paramètres',
}

function Breadcrumb() {
  const pathname = usePathname()

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Array<{ label: string; href: string }> = []

  let acc = ''
  for (const seg of segments) {
    acc += '/' + seg
    const label = ROUTE_LABELS[acc]
    if (label) crumbs.push({ label, href: acc })
  }

  if (crumbs.length === 0) crumbs.push({ label: 'Dashboard', href: '/dashboard' })

  return (
    <nav className="flex items-center gap-1.5" aria-label="Fil d'Ariane">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-[--text-muted]" />}
          {i < crumbs.length - 1 ? (
            <Link
              href={crumb.href}
              className="font-mono text-xs text-[--text-muted] hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-mono text-xs text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ── UserDropdown ───────────────────────────────────────────────────────────────

function UserDropdown() {
  const [open, setOpen]     = useState(false)
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [initials, setInitials] = useState('?')
  const ref = useRef<HTMLDivElement>(null)
  const router  = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      const n = data?.full_name ?? session.user.email?.split('@')[0] ?? 'User'
      setName(n)
      setInitials(n.charAt(0).toUpperCase())
    }
    load()
  }, [supabase])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    href?: string,
    danger?: boolean,
    onClick?: () => void,
  ) => {
    const cls = cn(
      'flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors',
      danger
        ? 'text-error hover:bg-error/10'
        : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
    )
    const content = (
      <>
        <span className={danger ? 'text-error' : 'text-[--text-muted]'}>{icon}</span>
        {label}
      </>
    )
    if (href) {
      return (
        <Link key={label} href={href} onClick={() => setOpen(false)} className={cls}>
          {content}
        </Link>
      )
    }
    return (
      <button key={label} type="button" onClick={() => { setOpen(false); onClick?.() }} className={cls}>
        {content}
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-[34px] h-[34px] rounded-full bg-grad-primary flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="Menu utilisateur"
      >
        <span className="font-mono text-sm font-bold text-white">{initials}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-card border border-border/50 rounded-xl shadow-card overflow-hidden z-50">
          {/* User info */}
          <div className="px-3 py-3 border-b border-border/50">
            <p className="font-body text-sm text-foreground font-semibold truncate">{name}</p>
            <p className="font-mono text-xs text-[--text-muted] truncate mt-0.5">{email}</p>
          </div>

          <div className="p-1.5">
            {menuItem(<User size={14} />, 'Mon profil', '/settings')}
            {menuItem(<CreditCard size={14} />, 'Facturation', '/settings?tab=billing')}
            {menuItem(<Settings size={14} />, 'Paramètres', '/settings')}
          </div>

          <div className="p-1.5 border-t border-border/50">
            {menuItem(<LogOut size={14} />, 'Déconnexion', undefined, true, handleSignOut)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PlanChip ───────────────────────────────────────────────────────────────────

function PlanChip() {
  const supabase = createBrowserClient()
  const [plan, setPlan]       = useState<string | null>(null)
  const [credits, setCredits] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('profiles')
        .select('plan, credits')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setPlan(data.plan ?? 'free')
        setCredits(data.credits ?? 0)
      }
    }
    load()
  }, [supabase])

  if (!plan) return null

  if (plan === 'pro' || plan === 'studio') {
    return <Badge variant="purple">{plan === 'studio' ? 'Studio' : 'Pro'}</Badge>
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      <Badge variant="warning">Starter · {credits} crédit{credits !== 1 ? 's' : ''}</Badge>
      <Button variant="primary" size="sm" rightIcon={<ArrowRight size={12} />} asChild>
        <Link href="/settings?tab=billing">Upgrade</Link>
      </Button>
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMobileMenuToggle: () => void
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted text-[--text-muted] hover:text-foreground transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
        <Breadcrumb />
      </div>

      {/* Right: plan + notifications + avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <PlanChip />
        <NotificationPanel />
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
  )
}
