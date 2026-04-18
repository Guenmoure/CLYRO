'use client'

import { useLanguage } from '@/lib/i18n'

interface DashboardGreetingProps {
  firstName: string
}

export function DashboardGreeting({ firstName }: DashboardGreetingProps) {
  const { t } = useLanguage()
  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-foreground">
        {t('dashboardHi')}, {firstName} 👋
      </h1>
      <p className="font-body text-sm text-[--text-secondary] mt-0.5">
        {t('readyToCreate')}
      </p>
    </div>
  )
}
