import { ProfileForm } from '@/components/settings/profile-form'
import Link from 'next/link'

export const metadata = { title: 'Paramètres — CLYRO' }

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <p className="label-mono mb-1">Paramètres</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Mon compte</h1>
      </div>

      {/* Profil */}
      <div className="bg-navy-900 border border-border rounded-xl p-6">
        <h2 className="font-display font-semibold text-foreground mb-6">Profil</h2>
        <ProfileForm />
      </div>

      {/* Abonnement */}
      <div className="bg-navy-900 border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground">Abonnement</h2>
          <Link
            href="/settings/billing"
            className="font-mono text-xs text-clyro-blue hover:underline uppercase tracking-widest"
          >
            Gérer →
          </Link>
        </div>
        <p className="text-muted-foreground text-sm font-body">
          Gérez votre plan, vos crédits et vos moyens de paiement.
        </p>
      </div>

      {/* Sécurité */}
      <div className="bg-navy-900 border border-border rounded-xl p-6">
        <h2 className="font-display font-semibold text-foreground mb-4">Sécurité</h2>
        <p className="text-muted-foreground text-sm font-body">
          Changement de mot de passe via le lien envoyé par email.
        </p>
        <ChangePasswordButton />
      </div>
    </div>
  )
}

function ChangePasswordButton() {
  'use client'
  return (
    <button className="mt-4 font-body text-sm text-clyro-blue hover:underline">
      Envoyer un lien de réinitialisation →
    </button>
  )
}
