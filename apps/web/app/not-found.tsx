import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <Logo variant="icon" size="md" href={false} />

        <div className="mt-8">
          <p className="font-mono text-sm text-primary tracking-wider uppercase">
            404
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground mt-2">
            Page not found
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mt-3 max-w-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Button variant="primary" size="md" leftIcon={<Home size={14} />} asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button variant="secondary" size="md" leftIcon={<ArrowLeft size={14} />} asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
