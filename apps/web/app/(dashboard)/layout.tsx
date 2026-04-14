'use client'

import { TopBar } from '@/components/layout/TopBar'
import { FloatingUserCard } from '@/components/layout/FloatingUserCard'
import { RightSidebar } from '@/components/layout/RightSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar onMobileMenuToggle={() => { /* no left sidebar */ }} />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
        <RightSidebar />
      </div>
      <FloatingUserCard />
    </div>
  )
}
