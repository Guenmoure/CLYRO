import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

export const metadata = {
  title: 'Sign in — CLYRO',
}

export default function LoginPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          <span className="text-gradient-animated">C</span>LYRO
        </h1>
        <p className="text-[--text-muted] mt-2 font-body text-sm">
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
