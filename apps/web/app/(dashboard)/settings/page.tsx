'use client'

import Link from 'next/link'
import { ProfileForm } from '@/components/settings/profile-form'
import { Shield, CreditCard, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

        <div>
          <p className="font-mono text-xs text-brand-muted uppercase tracking-widest mb-1">Account</p>
          <h1 className="font-display text-2xl font-bold text-brand-text">Settings</h1>
        </div>

        {/* Profile */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <h2 className="font-display font-semibold text-brand-text mb-5">Profile</h2>
          <ProfileForm />
        </div>

        {/* Billing */}
        <Link href="/settings/billing"
          className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-2xl p-6 hover:border-brand-primary/40 hover:shadow-brand-sm transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary-light flex items-center justify-center">
              <CreditCard size={18} className="text-brand-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-brand-text">Abonnement & Crédits</h2>
              <p className="font-body text-sm text-brand-muted mt-0.5">Gérer votre plan, vos crédits et moyens de paiement.</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-brand-muted group-hover:text-brand-primary transition-colors" />
        </Link>

        {/* Security */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center">
              <Shield size={18} className="text-brand-muted" />
            </div>
            <h2 className="font-display font-semibold text-brand-text">Sécurité</h2>
          </div>
          <p className="text-brand-muted text-sm font-body mb-4">
            Changement de mot de passe via un lien envoyé par email.
          </p>
          <button className="font-body text-sm text-brand-primary hover:underline font-medium">
            Envoyer un lien de réinitialisation →
          </button>
        </div>

      </div>
    </div>
  )
}
