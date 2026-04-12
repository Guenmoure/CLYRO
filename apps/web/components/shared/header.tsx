'use client'

import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationPanel } from '@/components/shared/notification-panel'

export function Header() {
  return (
    <header className="h-14 flex items-center justify-end px-6 gap-2 shrink-0 relative z-10">
      <ThemeToggle />
      <NotificationPanel />
    </header>
  )
}
