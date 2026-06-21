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
import { resolveActiveEntry } from '@/components/layout/nav-model'

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
  const [collapsed,  setCollapsed]  = useState(false)  // default: panel open
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated,   setHydrated]   = useState(false)
  const pathname = usePathname()

  // Does the current section have a contextual panel?
  const activeEntry = resolveActiveEntry(pathname)
  const sectionHasPanel = (activeEntry?.children?.length ?? 0) > 0
  // Desktop content offset: rail (72) + panel (210) when a panel is shown.
  const panelShown = sectionHasPanel && !collapsed

  // Read persisted state after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === 'true')
    setHydrated(true)
  }, [])

  function handleToggle(val: boolean) {
    setCollapsed(val)
    localStorage.setItem(STORAGE_KEY, String(val))
  }

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
          collapsed={collapsed}
          onToggle={handleToggle}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content — offset by sidebar width on desktop */}
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-w-0',
            'md:transition-[margin-left] md:duration-300 md:ease-in-out',
            // Rail = 72px; rail + panel = 282px.
            !hydrated && (sectionHasPanel ? 'md:ml-[282px]' : 'md:ml-[72px]'),
            hydrated && (panelShown ? 'md:ml-[282px]' : 'md:ml-[72px]'),
          )}
        >
          <TopBar user={user} onMobileMenuToggle={() => setMobileOpen(v => !v)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>

        <CommandPalette />
      </div>
    </LanguageProvider>
  )
}
