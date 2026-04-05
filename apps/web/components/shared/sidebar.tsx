'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Video,
  Wand2,
  Mic2,
  FolderOpen,
  Palette,
  Settings,
  LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',           icon: Home       },
  { href: '/projects',  label: 'My Projects',    icon: FolderOpen },
  { href: '/faceless',  label: 'Faceless Video',  icon: Video      },
  { href: '/motion',    label: 'Motion Design',   icon: Wand2      },
  { href: '/voices',    label: 'AI Voiceover',    icon: Mic2       },
  { href: '/brand',     label: 'Brand Kit',       icon: Palette    },
  { href: '/settings',  label: 'Settings',        icon: Settings   },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-60 glass-heavy glass-border-r flex-col py-5 shrink-0 relative z-20">
      {/* Logo */}
      <Link href="/dashboard" className="px-5 mb-8 flex items-center gap-2">
        <span className="font-display font-extrabold text-xl">
          <span className="text-gradient-animated">C</span>
          <span className="text-gray-900 dark:text-white">LYRO</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider glass-pill text-clyro-blue px-1.5 py-0.5 rounded-full">
          Beta
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3">
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
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'glass-pill text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-white/40 glass-hover hover:text-gray-900 dark:hover:text-white/80 rounded-xl'
              )}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className={isActive ? 'text-clyro-cyan' : ''}
              />
              <span className="font-body text-sm font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-clyro-cyan shrink-0 shadow-[0_0_6px_rgba(56,232,255,0.8)]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pt-3 mt-2 glass-border-t">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-400 dark:text-white/30 glass-hover hover:text-gray-700 dark:hover:text-white/70 transition-all duration-200"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span className="font-body text-sm font-medium leading-none">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
