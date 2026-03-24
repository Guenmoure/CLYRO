'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Video,
  Sparkles,
  Clock,
  Mic2,
  Settings,
  LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/faceless', label: 'Faceless Videos', icon: Video },
  { href: '/motion', label: 'Motion Graphics', icon: Sparkles },
  { href: '/history', label: 'Historique', icon: Clock },
  { href: '/voices', label: 'Mes voix', icon: Mic2 },
  { href: '/settings', label: 'Paramètres', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-64 bg-navy-900 border-r border-border flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard">
          <h1 className="font-display text-2xl font-bold text-gradient-primary">CLYRO</h1>
        </Link>
        <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-widest">
          AI Video Platform
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body transition-all duration-200',
                isActive
                  ? 'bg-clyro-blue/10 text-clyro-blue border border-clyro-blue/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-navy-800'
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-body text-muted-foreground hover:text-foreground hover:bg-navy-800 transition-all w-full"
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
