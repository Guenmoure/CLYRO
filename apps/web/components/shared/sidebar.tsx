'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Home, Video, Wand2, Mic2, FolderOpen, Palette, Settings,
  LogOut, ChevronRight, Gem, HelpCircle,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',      icon: Home       },
  { href: '/projects',  label: 'Projects',  icon: FolderOpen },
  { href: '/faceless',  label: 'Faceless',  icon: Video      },
  { href: '/motion',    label: 'Motion',    icon: Wand2      },
  { href: '/voices',    label: 'Voiceover', icon: Mic2       },
  { href: '/brand',     label: 'Brand Kit', icon: Palette    },
]

function UserMenu({ user, plan, onSignOut }: {
  user: User
  plan: string
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const name    = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'
  const email   = user.email ?? ''
  const initials = name.charAt(0).toUpperCase()
  const planLabel = plan === 'studio' ? 'Studio' : plan === 'pro' ? 'Pro' : 'Free plan'

  return (
    <div ref={ref} className="relative w-full px-2 pt-2 border-t border-[#EAEAEC] dark:border-white/5">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group flex flex-col items-center justify-center gap-1 w-full py-2.5 px-1 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-150"
        title={name}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8A57EA] to-[#4D9FFF] flex items-center justify-center shadow-sm">
          <span className="font-bold text-white text-xs select-none">{initials}</span>
        </div>
        <span className="text-[9px] font-medium leading-none tracking-wide text-[#9CA3AF] dark:text-white/30 group-hover:text-[#374151] dark:group-hover:text-white truncate w-full text-center px-0.5">
          {name.split(' ')[0]}
        </span>
      </button>

      {/* Dropdown — opens to the right of the sidebar */}
      {open && (
        <div className="absolute left-full bottom-0 ml-2 w-[220px] bg-white dark:bg-[#18181B] border border-[#EAEAEC] dark:border-white/8 rounded-2xl shadow-xl overflow-hidden z-50">

          {/* User info */}
          <div className="px-4 py-3 border-b border-[#EAEAEC] dark:border-white/8">
            <p className="text-[11px] text-gray-400 dark:text-white/30 truncate mb-2">{email}</p>
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8A57EA] to-[#4D9FFF] flex items-center justify-center shrink-0">
                  <span className="font-bold text-white text-xs">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30">1 · {planLabel}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 dark:text-white/30 shrink-0" />
            </div>
          </div>

          {/* Actions */}
          <div className="py-1.5">
            <MenuItem icon={<Gem size={15} />} label="Upgrade Plan" gold onClick={() => setOpen(false)} href="/settings?tab=plan" />
            <MenuItem icon={<Settings size={15} />} label="Settings" onClick={() => setOpen(false)} href="/settings" />
          </div>

          <div className="border-t border-[#EAEAEC] dark:border-white/8 py-1.5">
            <MenuItem icon={<HelpCircle size={15} />} label="Help" chevron onClick={() => setOpen(false)} href="mailto:support@clyro.app" />
          </div>

          <div className="border-t border-[#EAEAEC] dark:border-white/8 py-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <LogOut size={15} className="text-gray-400 dark:text-white/30" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, gold, chevron, href, onClick }: {
  icon: React.ReactNode
  label: string
  gold?: boolean
  chevron?: boolean
  href?: string
  onClick?: () => void
}) {
  const cls = cn(
    'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
    gold
      ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
      : 'text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
  )
  const inner = (
    <>
      <span className={gold ? 'text-amber-500' : 'text-gray-400 dark:text-white/30'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {chevron && <ChevronRight size={13} className="text-gray-300 dark:text-white/20" />}
    </>
  )
  if (href?.startsWith('mailto:') || href?.startsWith('http')) {
    return <a href={href} onClick={onClick} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  }
  if (href) return <Link href={href} onClick={onClick} className={cls}>{inner}</Link>
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createBrowserClient()
  const [user, setUser]   = useState<User | null>(null)
  const [plan, setPlan]   = useState('free')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setUser(session.user)
      const { data } = await supabase.from('profiles').select('plan').eq('id', session.user.id).single()
      if (data) setPlan(data.plan ?? 'free')
    }
    load()
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-[72px] bg-white dark:bg-[#141417] border-r border-[#EAEAEC] dark:border-white/5 flex-col items-center py-4 shrink-0 relative z-20 transition-colors duration-300">

      {/* Logo */}
      <Link
        href="/dashboard"
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8A57EA] to-[#4D9FFF] flex items-center justify-center mb-6 shrink-0 shadow-md hover:shadow-lg transition-shadow"
        title="CLYRO"
      >
        <span className="font-display font-extrabold text-white text-sm select-none">C</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'group flex flex-col items-center justify-center gap-1 w-full py-2.5 px-1 rounded-xl transition-all duration-150',
                isActive
                  ? 'bg-[#F4EFFE] dark:bg-[#8A57EA]/10 text-[#8A57EA]'
                  : 'text-[#9CA3AF] dark:text-white/30 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-[#374151] dark:hover:text-white'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.6} className="shrink-0" />
              <span className={cn(
                'text-[9px] font-medium leading-none tracking-wide text-center truncate w-full px-0.5',
                isActive ? 'text-[#8A57EA]' : 'text-[#9CA3AF] dark:text-white/30 group-hover:text-[#374151] dark:group-hover:text-white'
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: User menu */}
      {user ? (
        <UserMenu user={user} plan={plan} onSignOut={handleSignOut} />
      ) : (
        <div className="w-full px-2 pt-2 border-t border-[#EAEAEC] dark:border-white/5">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 mx-auto animate-pulse" />
        </div>
      )}
    </aside>
  )
}
