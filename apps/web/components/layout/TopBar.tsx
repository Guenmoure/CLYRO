'use client'

import { Menu } from 'lucide-react'
import { NotificationPanel } from '@/components/shared/notification-panel'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// ── TopBar ─────────────────────────────────────────────────────────────────────
// Minimaliste : juste la cloche de notification + le toggle de thème.
// Le profil utilisateur est dans la sidebar (bas-gauche).
// Le breadcrumb / plan chip / avatar dropdown ont été retirés pour épurer.

interface TopBarProps {
  onMobileMenuToggle: () => void
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
      {/* Left: hamburger (mobile only) */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted text-[--text-muted] hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Right: notifications + theme toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationPanel />
        <ThemeToggle />
      </div>
    </header>
  )
}
