import { Sidebar } from '@/components/shared/sidebar'
import { Header } from '@/components/shared/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* Sidebar — cachée sur mobile, visible desktop */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
