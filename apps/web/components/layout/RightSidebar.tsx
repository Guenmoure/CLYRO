'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Video, Sparkles, Palette, History, Mic,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Workspace nav items ────────────────────────────────────────────────────────

const WORKSPACE_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',       icon: LayoutGrid, exact: true },
  { href: '/faceless',  label: 'Faceless Videos', icon: Video },
  { href: '/motion',    label: 'Motion Design',   icon: Sparkles },
  { href: '/brand',     label: 'Brand Kit',       icon: Palette },
  { href: '/projects',  label: 'Historique',      icon: History },
  { href: '/voices',    label: 'Mes voix',        icon: Mic },
] as const

// ── RightSidebar ──────────────────────────────────────────────────────────────
// Sidebar minimaliste à droite — liste seulement les modules du workspace.
// Le profil utilisateur reste dans le FloatingUserCard (bas-gauche).

export function RightSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col shrink-0 w-56 m-3 ml-0 rounded-2xl glass overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 glass-border-b">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
          Workspace
        </p>
      </div>

      {/* Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {WORKSPACE_ITEMS.map((item) => {
          const Icon = item.icon
          const isExact = 'exact' in item && item.exact
          const isActive = pathname === item.href || (!isExact && pathname.startsWith(item.href + '/'))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                isActive
                  ? 'bg-blue-500/15 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'text-[--text-secondary] hover:bg-white/40 dark:hover:bg-white/5 hover:text-foreground',
              )}
            >
              <Icon
                size={16}
                className={cn(
                  'shrink-0 transition-colors',
                  isActive ? 'text-blue-500' : 'text-[--text-muted] group-hover:text-[--text-secondary]',
                )}
              />
              <span className="font-body text-sm truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
