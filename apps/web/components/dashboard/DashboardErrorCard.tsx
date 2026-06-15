'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n'

export function DashboardErrorCard() {
  const { t } = useLanguage()
  return (
    <Card variant="elevated" className="flex items-center gap-4 py-5 px-6">
      <div className="bg-error/10 rounded-xl p-3 shrink-0">
        <AlertCircle className="text-error" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-foreground">{t('db_loadError')}</p>
      </div>
      <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} asChild>
        <Link href="/dashboard">{t('db_retry')}</Link>
      </Button>
    </Card>
  )
}
