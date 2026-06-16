'use client'

import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { useLanguage } from '@/lib/i18n'

export function LoginPageContent() {
  const { t } = useLanguage()

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          {t('auth_loginTagline')}
        </p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">{t('signIn')}</h2>
          <p className="text-[--text-secondary] text-sm mt-1 font-body">
            {t('auth_noAccount')}{' '}
            <Link href="/signup" className="text-[--primary] hover:text-foreground transition-colors duration-200 font-medium">
              {t('signUp')}
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
