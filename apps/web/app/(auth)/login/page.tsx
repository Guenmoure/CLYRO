import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

export const metadata = {
  title: 'Connexion — CLYRO',
}

export default function LoginPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-white">
          <span className="text-gradient-animated">C</span>LYRO
        </h1>
        <p className="text-white/40 mt-2 font-body text-sm">
          Content to video in minutes
        </p>
      </div>

      {/* Card */}
      <div className="glass glass-heavy rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-white">Connexion</h2>
          <p className="text-white/50 text-sm mt-1 font-body">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="text-clyro-primary hover:text-white transition-colors duration-200 font-medium">
              S&apos;inscrire
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
