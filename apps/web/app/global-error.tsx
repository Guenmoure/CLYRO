'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global error boundary]', error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0a0a', color: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px', fontWeight: 600 }}>
            Une erreur est survenue
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 16px' }}>
            L&apos;application a rencontré un problème inattendu.
          </p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717a', margin: '0 0 24px' }}>
              Code : {error.digest}
            </p>
          )}
          {error.message && (
            <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 24px', fontFamily: 'monospace' }}>
              {error.message}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              marginRight: 8,
            }}
          >
            Réessayer
          </button>
          <a
            href="/login"
            style={{
              background: 'transparent',
              color: '#fafafa',
              border: '1px solid #3f3f46',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Se reconnecter
          </a>
        </div>
      </body>
    </html>
  )
}
