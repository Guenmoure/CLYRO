import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

export const metadata = {
  title: 'Connexion — CLYRO',
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-gradient-primary">CLYRO</h1>
        <p className="text-muted-foreground mt-2 font-body text-sm">
          Content to video in minutes
        </p>
      </div>

      {/* Card */}
      <div className="bg-navy-900 border border-border rounded-2xl p-8 shadow-lg">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Connexion</h2>
          <p className="text-muted-foreground text-sm mt-1 font-body">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="text-clyro-blue hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
