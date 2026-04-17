import { Logo } from '@/components/ui/Logo'

/**
 * Global loading UI — shown by Next.js during route transitions and
 * while server components are streaming. Renders a full-screen splash
 * with the CLYRO logo and a subtle pulse animation.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-[#667EEA]/20 via-[#7C3AED]/15 to-[#00B4FF]/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Logo with breathing animation */}
      <div className="relative animate-pulse-slow">
        <Logo variant="full" size="xl" href={false} />
      </div>

      {/* Spinner dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[#667EEA] to-[#00B4FF] animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
