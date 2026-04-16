import { LanguageProvider } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-15%] left-[10%] w-[500px] h-[500px] bg-[var(--primary)]/[0.08] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[5%] w-[420px] h-[420px] bg-[var(--secondary)]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>
    </LanguageProvider>
  )
}
