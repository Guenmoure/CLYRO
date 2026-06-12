'use client'

/**
 * Shared error boundary for every route inside the (dashboard) group.
 * Individual routes can still provide a more specific error.tsx; when
 * absent, this boundary catches rendering failures and lets the user
 * retry or navigate back.
 *
 * Note: the raw error.message is intentionally NOT rendered — it can
 * contain technical internals. We log it to the console and only show
 * the digest (an opaque correlation id) when present.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n'

export default function DashboardGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

  useEffect(() => {
    console.error('[(dashboard) error boundary]', error)
  }, [error])

  return (
    <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
      <Card variant="elevated" className="flex flex-col items-center text-center gap-4 py-10 px-6">
        <div className="bg-error/10 rounded-2xl p-4">
          <AlertCircle className="text-error" size={28} />
        </div>
        <div>
          <h1 className="font-display text-xl text-foreground mb-1">
            {t('errb_title')}
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mb-2">
            {t('errb_desc')}
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-[--text-muted]">
              {t('errb_code').replace('{code}', error.digest)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" leftIcon={<RefreshCw size={14} />} onClick={() => reset()}>
            {t('retry')}
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/dashboard">{t('st_backToDashboard')}</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
