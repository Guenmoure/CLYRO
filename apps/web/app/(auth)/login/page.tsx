import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export const metadata = {
  title: 'Sign in — CLYRO',
}

export default function LoginPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          Content to video in minutes
        </p>
      </div>

      {/* Card */}
      <div className="glass glass-heavy rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Sign in</h2>
          <p className="text-[--text-secondary] text-sm mt-1 font-body">
            Don't have an account?{' '}
            <Link href="/signup" className="text-[--primary] hover:text-foreground transition-colors duration-200 font-medium">
              Sign up
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
