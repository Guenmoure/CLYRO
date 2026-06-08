'use client'

/**
 * Brand Book — Phase 5 du portage Pomelli.
 *
 * Viewer du brand book généré depuis le Brand Kit. Header avec badge
 * publication, boutons Regenerate / Print to PDF / Publish toggle /
 * Open public link / Copy link. Iframe sandbox affiche le HTML stocké
 * dans `brand_books.html_snapshot`.
 *
 * V1 simple : la conversion en PDF se fait côté navigateur via window.print(),
 * pas de génération server-side. C'est suffisant pour la plupart des usages
 * et garde la stack légère. V2 pourra ajouter Puppeteer si on veut un PDF
 * strict côté serveur.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, AlertCircle, RefreshCw, Printer, Link2, Globe, Lock,
  ExternalLink, Check, FileDown,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import {
  getBrandKit,
  getBrandBook,
  generateBrandBook,
  publishBrandBook,
  unpublishBrandBook,
  type BrandBook,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

function publicUrlFor(book: BrandBook): string | null {
  if (!book.public_token || !book.is_published) return null
  return `${API_BASE}/api/v1/brand/book/public/${book.public_token}`
}

export default function BrandBookPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [book, setBook] = useState<BrandBook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [togglingPublish, setTogglingPublish] = useState(false)
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    Promise.all([getBrandKit(kitId), getBrandBook(kitId).catch(() => null)])
      .then(([k, b]) => {
        setKit(k.data)
        if (b) setBook(b.data)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [kitId])

  // ── Actions ───────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    try {
      const res = await generateBrandBook(kitId)
      setBook(res.data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [generating, kitId])

  async function togglePublish() {
    if (!book || togglingPublish) return
    setTogglingPublish(true)
    try {
      const res = book.is_published
        ? await unpublishBrandBook(book.id)
        : await publishBrandBook(book.id)
      setBook(res.data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish toggle failed')
    } finally {
      setTogglingPublish(false)
    }
  }

  function handlePrint() {
    // Le iframe est `srcdoc`, donc on imprime directement la window de l'iframe.
    iframeRef.current?.contentWindow?.print()
  }

  async function copyPublicLink() {
    if (!book) return
    const url = publicUrlFor(book)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignored */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </BrandKitLayout>
    )
  }
  if (error || !kit) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error ?? 'Brand kit not found'}</p>
        </div>
      </BrandKitLayout>
    )
  }

  // No book yet → empty state with primary CTA to generate
  if (!book) {
    return (
      <BrandKitLayout kitId={kitId} kitName={kit.name}>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">Brand Book</div>
          <h2 className="font-display text-2xl font-semibold text-foreground">No brand book yet</h2>
          <p className="font-body text-sm text-[--text-muted]">
            Generate a guide from your Business DNA — logo, palette, tagline,
            values, aesthetic, tone of voice. Free, instant, regeneratable any
            time the DNA changes.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg bg-foreground text-background font-display text-sm font-medium px-4 py-2',
              generating && 'opacity-50 cursor-not-allowed',
            )}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Generate brand book
          </button>
        </div>
      </BrandKitLayout>
    )
  }

  const publicUrl = publicUrlFor(book)

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <PublishedBadge published={book.is_published} />
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        title="Regenerate from the current DNA. Creates a new version."
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted',
          generating && 'opacity-50 cursor-not-allowed',
        )}
      >
        {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Regenerate
      </button>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted"
        title="Render the iframe via the browser print dialog (browser-side rendering)"
      >
        <Printer size={12} /> Print
      </button>
      <a
        href={`${API_BASE}/api/v1/brand/book/${book.id}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted"
        title="Server-side PDF generated with pdfkit (deterministic fonts and layout)"
      >
        <FileDown size={12} /> Download PDF
      </a>
      <button
        type="button"
        onClick={togglePublish}
        disabled={togglingPublish}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-medium',
          book.is_published
            ? 'border border-border bg-background text-foreground hover:bg-muted'
            : 'bg-foreground text-background',
          togglingPublish && 'opacity-50 cursor-not-allowed',
        )}
      >
        {togglingPublish ? <Loader2 size={12} className="animate-spin" /> : book.is_published ? <Lock size={12} /> : <Globe size={12} />}
        {book.is_published ? 'Unpublish' : 'Publish'}
      </button>
      {publicUrl && (
        <>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted"
          >
            <ExternalLink size={12} /> Open
          </a>
          <button
            type="button"
            onClick={copyPublicLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Link2 size={12} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </>
      )}
      <span className="font-mono text-[10px] text-[--text-muted] ml-2">v{book.version}</span>
    </div>
  )

  return (
    <BrandKitLayout kitId={kitId} kitName={kit.name} saveStatus={header}>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <iframe
          ref={iframeRef}
          title={`${kit.name} brand book`}
          srcDoc={book.html_snapshot}
          sandbox="allow-same-origin allow-modals"
          className="w-full"
          style={{ height: 'calc(100vh - 220px)', minHeight: 600, border: 0 }}
        />
      </div>
    </BrandKitLayout>
  )
}

function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        published ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-[--text-muted]',
      )}
    >
      {published ? <Globe size={10} /> : <Lock size={10} />}
      {published ? 'Published' : 'Private'}
    </span>
  )
}
