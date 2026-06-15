'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

  useEffect(() => {
    console.error('[Dashboard error boundary]', error)
  }, [error])

  return (
    <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
      <Card variant="elevated" className="flex flex-col items-center text-center gap-4 py-10 px-6">
        <div className="bg-error/10 rounded-2xl p-4">
          <AlertCircle className="text-error" size={28} />
        </div>
        <div>
          <h1 className="font-display text-xl text-foreground mb-1">
            {t('db_errorTitle')}
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mb-2">
            {t('db_errorDesc')}
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-[--text-muted]">
              {t('db_errorCode')}: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" leftIcon={<RefreshCw size={14} />} onClick={() => reset()}>
            {t('db_retry')}
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/login">{t('db_reconnect')}</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
