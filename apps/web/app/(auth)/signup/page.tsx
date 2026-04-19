import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export const metadata = {
  title: 'Sign up — CLYRO',
}

export default function SignupPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          From script to video in 10 minutes
        </p>
      </div>

      {/* Card */}
      <div className="glass glass-heavy rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Create a free account
          </h2>
          <p className="text-[--text-secondary] text-sm mt-1 font-body">
            Already signed up?{' '}
            <Link href="/login" className="text-[--primary] hover:text-foreground transition-colors duration-200 font-medium">
              Sign in
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>

      <p className="text-center text-xs text-[--text-disabled] font-body">
        250 free credits on signup. No credit card required.
      </p>
    </div>
  )
}
