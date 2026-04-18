'use client'

/**
 * Shared error boundary for every route inside the (dashboard) group.
 * Individual routes can still provide a more specific error.tsx; when
 * absent, this boundary catches rendering failures and lets the user
 * retry or navigate back.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function DashboardGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
            Une erreur est survenue
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mb-2">
            Cette page n&apos;a pas pu être chargée.
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-[--text-muted]">
              Code : {error.digest}
            </p>
          )}
          {error.message && (
            <p className="font-body text-xs text-[--text-muted] mt-2 max-w-md">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" leftIcon={<RefreshCw size={14} />} onClick={() => reset()}>
            Réessayer
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/dashboard">Retour au dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
