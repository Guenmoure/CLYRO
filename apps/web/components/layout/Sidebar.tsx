'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid, Video, Sparkles, Palette, History, Mic, Film, Package,
  Settings, HelpCircle, ChevronRight, ChevronUp, LogOut, Gem, Code2,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SettingsModal, type SettingsSectionId } from '@/components/settings/SettingsModal'

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

// ── Nav structure (translation keys) ──────────────────────────────────────────

function useNavSections() {
  const { t } = useLanguage()
  return [
    {
      label: t('workspace'),
      items: [
        { href: '/dashboard', label: t('dashboard'),       icon: LayoutGrid, exact: true },
        { href: '/studio',    label: t('aiAvatarStudio'),  icon: Film },
        { href: '/faceless',  label: t('facelessVideos'),  icon: Video },
        { href: '/motion',    label: t('motionDesign'),    icon: Sparkles },
        { href: '/brand',     label: t('brandKit'),        icon: Palette },
        { href: '/projects',  label: t('projects'),        icon: History },
        { href: '/assets',    label: t('assets'),          icon: Package },
      ],
    },
  ]
}

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
    'relative group flex items-center gap-3 rounded-xl transition-colors duration-150 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
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
  const { t } = useLanguage()
  const [name, setName]       = useState<string | null>(null)
  const [email, setEmail]     = useState<string>('')
  const [plan, setPlan]       = useState<string>('free')
  const [initials, setInitials] = useState('?')

  // Dropdown + modal state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('account')
  const cardRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handler(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  function openSettings(section: SettingsSectionId) {
    setSettingsSection(section)
    setDropdownOpen(false)
    setSettingsOpen(true)
  }

  const planLabel = plan === 'pro' ? 'Pro' : plan === 'studio' ? 'Studio' : t('freePlan')

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative border-t border-white/[0.07] dark:border-white/[0.06] mt-auto pt-3',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className={cn(
          'group flex items-center gap-3 py-2 rounded-xl w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          collapsed ? 'justify-center px-0' : 'px-2',
          dropdownOpen ? 'bg-muted' : 'hover:bg-muted',
        )}
      >
        <div className="w-8 h-8 rounded-full bg-grad-primary flex items-center justify-center shrink-0">
          <span className="font-mono text-xs font-bold text-white">{initials}</span>
        </div>
        {!collapsed && name && (
          <div className="min-w-0 flex-1 text-left">
            <p className="font-body text-sm text-foreground truncate leading-none mb-0.5">{name}</p>
            <p className="font-mono text-[11px] text-[--text-secondary] truncate">{planLabel}</p>
          </div>
        )}
        {!collapsed && <ChevronUp size={14} className={cn('shrink-0 text-[--text-muted] transition-transform', dropdownOpen && 'rotate-180')} />}
        {collapsed && <NavTooltip label={name ?? email.split('@')[0] ?? t('account')} />}
      </button>

      {/* Dropdown — HeyGen-style */}
      {dropdownOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-up',
            collapsed
              ? 'left-full ml-2 bottom-0 w-64'
              : 'left-2 right-2 bottom-full mb-2',
          )}
        >
          {/* Header: email + profile */}
          <div className="px-4 pt-3 pb-3 border-b border-border">
            <p className="font-body text-xs text-[--text-secondary] truncate mb-2">{email}</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-grad-primary flex items-center justify-center shrink-0">
                <span className="font-mono text-sm font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-foreground truncate">{name ?? 'User'}</p>
                <p className="font-mono text-[11px] text-[--text-secondary]">{planLabel}</p>
              </div>
            </div>
          </div>

          {/* Main actions */}
          <div className="p-2 space-y-0.5">
            <DropdownItem
              icon={<Gem size={15} className="text-amber-500" />}
              label={t('upgradePlan')}
              href="/pricing"
              primary
            />
            <DropdownItem
              icon={<Settings size={15} />}
              label={t('userSettings')}
              onClick={() => openSettings('account')}
            />
          </div>

          {/* Secondary — Help */}
          <div className="p-2 space-y-0.5 border-t border-border">
            <DropdownItem
              icon={<Code2 size={15} />}
              label={t('developers')}
              onClick={() => openSettings('api')}
              trailing={<ChevronRight size={13} className="text-[--text-muted]" />}
            />
            <DropdownItem
              icon={<HelpCircle size={15} />}
              label={t('help')}
              href="mailto:support@clyro.app"
              external
              trailing={<ChevronRight size={13} className="text-[--text-muted]" />}
            />
          </div>

          {/* Log out */}
          <div className="p-2 border-t border-border">
            <DropdownItem
              icon={<LogOut size={15} />}
              label={t('userLogout')}
              onClick={onSignOut}
              danger
            />
          </div>
        </div>
      )}

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
      />
    </div>
  )
}

// ── DropdownItem ────────────────────────────────────────────────────────────

function DropdownItem({
  icon, label, onClick, href, external, primary, danger, trailing,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  external?: boolean
  primary?: boolean
  danger?: boolean
  trailing?: React.ReactNode
}) {
  const className = cn(
    'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-body transition-colors',
    danger
      ? 'text-error hover:bg-error/10'
      : primary
        ? 'text-foreground font-semibold hover:bg-muted'
        : 'text-foreground hover:bg-muted',
  )
  const content = (
    <>
      <span className={cn('shrink-0', danger ? 'text-error' : 'text-[--text-secondary]')}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {trailing}
    </>
  )
  if (href) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={className}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className} role="menuitem">
      {content}
    </button>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const supabase = createBrowserClient()
  const { t } = useLanguage()
  const navSections = useNavSections()

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
          'fixed inset-y-3 left-3 z-40',
          'glass rounded-2xl',
          'flex flex-col',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-60',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-14 border-b border-white/[0.07] dark:border-white/[0.06] shrink-0 relative',
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
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-muted border border-border rounded-full items-center justify-center shadow-card hover:bg-border transition-colors z-10 after:absolute after:inset-[-6px] after:content-['']"
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            <ChevronRight
              size={13}
              className={cn('text-[--text-muted] transition-transform duration-300', !collapsed && 'rotate-180')}
            />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-4">
          {navSections.map((section) => (
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
