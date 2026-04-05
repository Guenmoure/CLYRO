import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'

export const metadata = {
  title: 'Inscription — CLYRO',
}

export default function SignupPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-white">
          <span className="text-gradient-animated">C</span>LYRO
        </h1>
        <p className="text-white/40 mt-2 font-body text-sm">
          De ton script à ta vidéo en 10 minutes
        </p>
      </div>

      {/* Card */}
      <div className="glass glass-heavy rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-white">
            Créer un compte gratuit
          </h2>
          <p className="text-white/50 text-sm mt-1 font-body">
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-clyro-primary hover:text-white transition-colors duration-200 font-medium">
              Se connecter
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>

      <p className="text-center text-xs text-white/30 font-body">
        3 vidéos gratuites à l&apos;inscription. Aucune carte requise.
      </p>
    </div>
  )
}
