'use client'

import Link from 'next/link'
import { ProfileForm } from '@/components/settings/profile-form'
import { Shield, CreditCard, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

        <div>
          <p className="font-mono text-xs text-gray-400 dark:text-white/40 uppercase tracking-widest mb-1">Account</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        {/* Profile */}
        <div className="glass glass-heavy rounded-2xl p-6">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-5">Profile</h2>
          <ProfileForm />
        </div>

        {/* Billing */}
        <Link href="/settings/billing"
          className="flex items-center justify-between glass glass-heavy rounded-2xl p-6 hover:border-clyro-primary/40 card-hover transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-clyro-primary/15 border border-clyro-primary/20 flex items-center justify-center">
              <CreditCard size={18} className="text-clyro-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900 dark:text-white">Abonnement & Crédits</h2>
              <p className="font-body text-sm text-gray-500 dark:text-white/50 mt-0.5">Gérer votre plan, vos crédits et moyens de paiement.</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-400 dark:text-white/30 group-hover:text-clyro-primary transition-colors duration-200" />
        </Link>

        {/* Security */}
        <div className="glass glass-heavy rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
              <Shield size={18} className="text-gray-400 dark:text-white/50" />
            </div>
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Sécurité</h2>
          </div>
          <p className="text-gray-500 dark:text-white/50 text-sm font-body mb-4">
            Changement de mot de passe via un lien envoyé par email.
          </p>
          <button className="font-body text-sm text-clyro-primary hover:text-clyro-primary/70 transition-colors duration-200 font-medium">
            Envoyer un lien de réinitialisation →
          </button>
        </div>

      </div>
    </div>
  )
}
