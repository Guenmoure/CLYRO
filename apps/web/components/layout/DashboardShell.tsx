'use client'

/**
 * DashboardShell — client wrapper that owns sidebar UI state.
 *
 * layout.tsx is a Server Component (data fetching).
 * DashboardShell is the Client Component that manages:
 *   - collapsed (desktop sidebar) — persisted in localStorage
 *   - mobileOpen (mobile drawer)
 *   - hydration guard (prevents SSR flash)
 *
 * It also re-provides LanguageProvider (which needs a browser context).
 */

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { LanguageProvider } from '@/lib/i18n'
import { CommandPalette } from '@/components/shared/command-palette'
import { cn } from '@/lib/utils'
// Audit 23/06/26 — editorial sidebar : single 268px column, no rail+panel
// state to track. Vague-1 keeps DashboardShell minimal so layout.tsx and
// downstream consumers don't have to change.
import { SIDEBAR_W } from '@/components/layout/nav-model'

// `collapsed` now means "contextual panel hidden". The icon rail is always
// visible on desktop. Persisted across sessions.
const STORAGE_KEY = 'clyro_sidebar_collapsed'

export interface SidebarUser {
  fullName:    string
  initials:    string
  plan:        string
  creditsLeft: number
  /** Audit 19/06/26 — operational override flag. When true, the sidebar
   *  + FloatingUserCard render an « Unlimited » badge instead of « 0/250 ».
   *  Plumbed from profiles.internal_unlimited via the dashboard layout SSR. */
  isUnlimited?: boolean
}

interface DashboardShellProps {
  children:      React.ReactNode
  user:          SidebarUser
  projectsCount: number
  draftsCount:   number
}

export function DashboardShell({
  children,
  user,
  projectsCount,
  draftsCount,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()  // eslint-disable-line @typescript-eslint/no-unused-vars

  // Auto-close mobile drawer on desktop resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <LanguageProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar
          user={user}
          projectsCount={projectsCount}
          draftsCount={draftsCount}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content — fixed offset by the editorial sidebar width (268px) */}
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-w-0',
          )}
          style={{ marginLeft: undefined }}
        >
          <div className="md:ml-[268px] flex flex-col h-full">
            <TopBar user={user} onMobileMenuToggle={() => setMobileOpen(v => !v)} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>

        <CommandPalette />
      </div>
    </LanguageProvider>
  )
}
// Reference SIDEBAR_W to satisfy unused-import linters until we wire it as a CSS var.
void SIDEBAR_W
