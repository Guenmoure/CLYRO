import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'

export const metadata = {
  title: 'Inscription — CLYRO',
}

export default function SignupPage() {
  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-gradient-primary">CLYRO</h1>
        <p className="text-muted-foreground mt-2 font-body text-sm">
          De ton script à ta vidéo en 10 minutes
        </p>
      </div>

      {/* Card */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 shadow-brand-md">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-brand-text">
            Créer un compte gratuit
          </h2>
          <p className="text-brand-muted text-sm mt-1 font-body">
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-brand-primary hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>

      <p className="text-center text-xs text-muted-foreground font-body">
        3 vidéos gratuites à l&apos;inscription. Aucune carte requise.
      </p>
    </div>
  )
}
