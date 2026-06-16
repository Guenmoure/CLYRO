'use client'

import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { useLanguage } from '@/lib/i18n'

export function SignupPageContent() {
  const { t } = useLanguage()

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          {t('auth_signupTagline')}
        </p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {t('auth_createTitle')}
          </h2>
          <p className="text-[--text-secondary] text-sm mt-1 font-body">
            {t('auth_hasAccount')}{' '}
            <Link href="/login" className="text-[--primary] hover:text-foreground transition-colors duration-200 font-medium">
              {t('signIn')}
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>

      <p className="text-center text-xs text-[--text-disabled] font-body">
        {t('auth_freeCredits')}
      </p>
    </div>
  )
}
