'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutGrid, Video, Sparkles, Palette, History, Mic,
  Settings, HelpCircle, LogOut, Zap,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// ── Nav items (mirror of the previous Sidebar) ────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',       icon: LayoutGrid, exact: true },
  { href: '/faceless',  label: 'Faceless Videos', icon: Video },
  { href: '/motion',    label: 'Motion Design',   icon: Sparkles },
  { href: '/brand',     label: 'Brand Kit',       icon: Palette },
  { href: '/projects',  label: 'Historique',      icon: History },
  { href: '/voices',    label: 'Mes voix',        icon: Mic },
] as const

const ACCOUNT_ITEMS = [
  { href: '/settings', label: 'Paramètres', icon: Settings },
  { href: 'mailto:support@clyro.app', label: 'Aide', icon: HelpCircle, external: true as const },
] as const

// ── FloatingUserCard ──────────────────────────────────────────────────────────

export function FloatingUserCard() {
  const supabase = createBrowserClient()
  const router   = useRouter()
  const pathname = usePathname()

  const [open, setOpen]   = useState(false)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan]   = useState<string>('free')
  const [credits, setCredits] = useState(0)
  const [initials, setInitials] = useState('?')

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name, plan, credits')
        .eq('id', session.user.id)
        .maybeSingle()
      const n = data?.full_name ?? session.user.email?.split('@')[0] ?? 'Utilisateur'
      setName(n)
      setPlan(data?.plan ?? 'free')
      setCredits(data?.credits ?? 0)
      setInitials(n.charAt(0).toUpperCase())
    }
    load()
  }, [supabase])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isPaid = plan === 'pro' || plan === 'studio'
  const planLabel = isPaid ? (plan === 'studio' ? 'Studio' : 'Pro') : 'Starter'

  return (
    <div
      ref={ref}
      className="fixed bottom-4 left-4 z-50"
    >
      {/* Expanded panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-3 w-72 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-up">
          {/* Profile header */}
          <div className="px-4 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-grad-primary flex items-center justify-center shrink-0">
                <span className="font-mono text-sm font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm text-foreground truncate">{name}</p>
                <p className="font-mono text-[11px] text-[--text-muted] truncate">{email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {isPaid ? (
                <Badge variant="purple">{planLabel}</Badge>
              ) : (
                <>
                  <Badge variant="warning">{planLabel} · {credits} crédit{credits !== 1 ? 's' : ''}</Badge>
                  <Link
                    href="/settings?tab=billing"
                    onClick={() => setOpen(false)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-grad-primary text-white px-2 py-1 text-[11px] font-display font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Zap size={11} /> Upgrade
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Workspace nav */}
          <div className="p-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] px-2 py-1.5">
              Workspace
            </p>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={pathname === item.href || (!('exact' in item && item.exact) && pathname.startsWith(item.href + '/'))}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>

          {/* Account nav */}
          <div className="p-2 border-t border-border/50">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] px-2 py-1.5">
              Compte
            </p>
            {ACCOUNT_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={false}
                external={'external' in item ? item.external : false}
                onClick={() => setOpen(false)}
              />
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm font-body text-error hover:bg-error/10 transition-colors"
            >
              <LogOut size={15} />
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* Trigger button (always visible) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu utilisateur"
        className={cn(
          'group relative flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl px-3 py-2.5 shadow-lg',
          'hover:border-border hover:shadow-xl hover:bg-card transition-all duration-200',
          open && 'border-border bg-card shadow-xl',
        )}
      >
        <div className="w-9 h-9 rounded-full bg-grad-primary flex items-center justify-center shrink-0">
          <span className="font-mono text-sm font-bold text-white">{initials}</span>
        </div>
        <div className="text-left min-w-0">
          <p className="font-display text-xs text-foreground truncate max-w-[140px]">{name || 'Compte'}</p>
          <p className="font-mono text-[10px] text-[--text-muted] uppercase tracking-wider">
            {planLabel}
          </p>
        </div>
      </button>
    </div>
  )
}

// ── NavLink ─────────────────────────────────────────────────────────────────

function NavLink({
  href, label, icon: Icon, active, external, onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  external?: boolean
  onClick: () => void
}) {
  const className = cn(
    'flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm font-body transition-colors',
    active
      ? 'bg-blue-500/15 text-foreground'
      : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
  )

  const content = (
    <>
      <Icon size={15} className={active ? 'text-blue-400' : 'text-[--text-muted]'} />
      {label}
    </>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {content}
      </a>
    )
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}
