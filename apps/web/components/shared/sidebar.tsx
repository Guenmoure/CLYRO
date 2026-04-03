'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Video,
  Wand2,
  Mic2,
  FolderOpen,
  Settings,
  LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',          icon: Home       },
  { href: '/projects',  label: 'My Projects',   icon: FolderOpen },
  { href: '/faceless',  label: 'Faceless Video', icon: Video      },
  { href: '/motion',    label: 'Motion Design',  icon: Wand2      },
  { href: '/voices',    label: 'AI Voiceover',   icon: Mic2       },
  { href: '/settings',  label: 'Settings',       icon: Settings   },
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
    <aside className="hidden md:flex w-60 bg-navy-900 border-r border-navy-700 flex-col py-5 shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="px-5 mb-8 block">
        <span className="font-display font-extrabold text-xl tracking-tight">
          <span className="text-clyro-cyan">C</span>
          <span className="text-white">LYRO</span>
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                isActive
                  ? 'bg-navy-700 text-white'
                  : 'text-white/40 hover:text-white/80 hover:bg-navy-800'
              )}
            >
              <Icon size={19} strokeWidth={isActive ? 2 : 1.5} />
              <span className="font-body text-sm font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-clyro-cyan shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pt-2 border-t border-navy-700 mt-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-white/30 hover:text-white/70 hover:bg-navy-800 transition-all"
        >
          <LogOut size={19} strokeWidth={1.5} />
          <span className="font-body text-sm font-medium leading-none">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
