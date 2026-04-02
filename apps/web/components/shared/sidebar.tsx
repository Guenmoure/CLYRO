'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Video,
  Wand2,
  Mic2,
  PenTool,
  FolderOpen,
  LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/faceless',  label: 'Faceless',      icon: Video    },
  { href: '/motion',    label: 'Motion',         icon: Wand2    },
  { href: '/voices',    label: 'Voices',         icon: Mic2     },
  { href: '/design',    label: 'Design',         icon: PenTool, soon: true },
  { href: '/projects',  label: 'Projects',       icon: FolderOpen },
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
    <aside className="hidden md:flex w-20 bg-brand-surface border-r border-brand-border flex-col items-center py-4">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="w-10 h-10 rounded-xl bg-grad-primary flex items-center justify-center mb-6 shrink-0"
      >
        <span className="font-display font-extrabold text-white text-sm tracking-tight">CL</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.soon ? '#' : item.href}
              aria-disabled={item.soon}
              className={cn(
                'relative flex flex-col items-center gap-1 w-full py-2.5 rounded-xl transition-all duration-200 group',
                item.soon
                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                  : isActive
                    ? 'bg-brand-primary-light text-brand-primary'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-bg'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="font-body text-[10px] font-medium leading-none">{item.label}</span>
              {item.soon && (
                <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold bg-brand-accent text-white px-1 rounded-full leading-tight">
                  Soon
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex flex-col items-center gap-1 w-full px-2 py-2.5 rounded-xl text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all"
      >
        <LogOut size={20} strokeWidth={1.5} />
        <span className="font-body text-[10px] font-medium leading-none">Quitter</span>
      </button>
    </aside>
  )
}
