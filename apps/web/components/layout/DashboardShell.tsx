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
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { LanguageProvider } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'clyro_sidebar_collapsed'

export interface SidebarUser {
  fullName:    string
  initials:    string
  plan:        string
  creditsLeft: number
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
  const [collapsed,  setCollapsed]  = useState(true)   // default collapsed
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated,   setHydrated]   = useState(false)

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
            !hydrated && 'md:ml-[72px]',
            hydrated && (collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'),
          )}
        >
          <TopBar onMobileMenuToggle={() => setMobileOpen(v => !v)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  )
}
