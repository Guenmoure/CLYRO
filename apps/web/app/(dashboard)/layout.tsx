import { Sidebar } from '@/components/shared/sidebar'
import { Header } from '@/components/shared/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-navy-950 overflow-hidden relative transition-colors duration-300">
      {/* Ambient color blobs — required for glass effect (dark mode only) */}
      <div className="hidden dark:block animate-float     absolute top-[-10%]  left-[15%]  w-[500px] h-[500px] bg-clyro-blue/10   rounded-full blur-[80px] pointer-events-none" />
      <div className="hidden dark:block animate-float-2   absolute bottom-[-5%] right-[10%] w-[420px] h-[420px] bg-clyro-purple/9  rounded-full blur-[80px] pointer-events-none" />
      <div className="hidden dark:block animate-float-rev absolute top-[40%]   left-[40%]  w-[340px] h-[340px] bg-clyro-cyan/5    rounded-full blur-[70px] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
