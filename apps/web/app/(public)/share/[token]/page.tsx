import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'

// UUIDs are 36 chars (8-4-4-4-12 + hyphens). Reject anything else early
// so we don't waste a DB roundtrip on obviously bogus tokens.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'   // never cache: revoked tokens must 404 immediately

interface SharedVideoRow {
  id:         string
  title:      string | null
  module:     string | null
  output_url: string | null
  created_at: string
}

async function fetchSharedVideo(token: string): Promise<SharedVideoRow | null> {
  if (!UUID_RE.test(token)) return null

  const supabase = createServerClient()
  // Calls the SECURITY DEFINER function added in migration
  // 20260427000000_video_share_token.sql. The function returns 0 rows
  // when the token is unknown or has been revoked.
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'resolve_shared_video' as any,
    { p_token: token } as any,
  )
  if (error || !data) return null
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

export async function generateMetadata({ params }: { params: { token: string } }) {
  const video = await fetchSharedVideo(params.token)
  if (!video) {
    return { title: 'Lien expiré — CLYRO' }
  }
  return {
    title: `${video.title ?? 'Vidéo partagée'} — CLYRO`,
    // Don't index public share pages — they're meant for one-off viewing,
    // not search engines.
    robots: { index: false, follow: false },
  }
}

export default async function SharedVideoPage({
  params,
}: {
  params: { token: string }
}) {
  const video = await fetchSharedVideo(params.token)
  if (!video) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Slim header with logo, NO dashboard nav */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-base font-bold text-foreground">
            CLYRO
          </Link>
          <Link
            href="/signup"
            className="font-mono text-xs text-[--text-muted] hover:text-foreground transition-colors"
          >
            Créer ma propre vidéo →
          </Link>
        </div>
      </header>

      <section className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">
          Vidéo partagée · lecture seule
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-6">
          {video.title ?? 'Vidéo sans titre'}
        </h1>

        {video.output_url ? (
          <div className="rounded-2xl overflow-hidden border border-border bg-black shadow-card-hover">
            <video
              src={video.output_url}
              controls
              playsInline
              className="w-full max-h-[75vh] object-contain bg-black"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-body text-sm text-[--text-secondary]">
              Cette vidéo n&apos;a pas encore de fichier exporté.
            </p>
          </div>
        )}

        <p className="font-mono text-xs text-[--text-muted] mt-6">
          Lien partagé via CLYRO. Le propriétaire peut révoquer l&apos;accès à tout moment.
        </p>
      </section>

      <footer className="border-t border-border/40 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="font-mono text-xs text-[--text-muted]">
            © 2026 CLYRO
          </p>
          <Link
            href="/"
            className="font-mono text-xs text-[--text-muted] hover:text-foreground transition-colors"
          >
            clyro.io
          </Link>
        </div>
      </footer>
    </main>
  )
}
