'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STORAGE_KEY = 'clyro_sidebar_collapsed'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed,   setCollapsed]   = useState(true)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [hydrated,    setHydrated]    = useState(false)

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

  // Close mobile drawer on viewport resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
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
          // Show only after hydration to prevent layout flash
          !hydrated && 'md:ml-[72px]',
          hydrated && (collapsed ? 'md:ml-[72px]' : 'md:ml-60'),
        )}
      >
        <TopBar onMobileMenuToggle={() => setMobileOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
