import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'

export const metadata = {
  title: 'Sign up — CLYRO',
}

export default function SignupPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          <span className="text-gradient-animated">C</span>LYRO
        </h1>
        <p className="text-[--text-muted] mt-2 font-body text-sm">
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
        3 free videos on signup. No credit card required.
      </p>
    </div>
  )
}
