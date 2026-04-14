'use client'

import { TopBar } from '@/components/layout/TopBar'
import { FloatingUserCard } from '@/components/layout/FloatingUserCard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar onMobileMenuToggle={() => { /* no sidebar to open */ }} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      <FloatingUserCard />
    </div>
  )
}
