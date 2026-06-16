import { type NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'
import { z } from 'zod'

// Optional POST body — { expiresInDays?: 1..365 }. Defaults to 30 days.
// Legacy callers that POST without a body keep working (the body is
// parsed leniently and the default applies).
const shareBodySchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
})
const DEFAULT_EXPIRES_IN_DAYS = 30

function expiryFromDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * GET /api/videos/:id/share
 *
 * Returns the current share state for the owner's video:
 *   { share_token: string | null, share_token_expires_at: string | null }
 *
 * Used by ShareLinkModal on open to render either an existing link or
 * an "Activate" CTA without minting a token speculatively.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('videos')
    .select('share_token, share_token_expires_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json({
    share_token: data.share_token ?? null,
    share_token_expires_at: data.share_token_expires_at ?? null,
  })
}

/**
 * POST /api/videos/:id/share
 *
 * Mints a new share_token (or rotates an existing one if `?rotate=1`).
 * Optional JSON body: { expiresInDays?: 1..365 } — defaults to 30.
 * Returns { share_token, share_token_expires_at }.
 *
 * On mint/rotation the expiry is set to now() + expiresInDays. A still-
 * valid existing token is reused as-is (no body required); an EXPIRED
 * existing token is treated like a rotation so the user never gets a
 * dead link back.
 *
 * The token is generated server-side via crypto.randomUUID() — opaque
 * and unguessable, used as-is in the public URL /share/[token].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rotate = req.nextUrl.searchParams.get('rotate') === '1'

  // Body is optional (legacy callers POST with no body) — treat an empty/
  // unparseable body as {}, but reject an explicitly invalid expiresInDays.
  const rawBody = await req.json().catch(() => ({}))
  const parsed = shareBodySchema.safeParse(rawBody ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'expiresInDays must be an integer between 1 and 365', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  const expiresInDays = parsed.data.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS

  // Fetch current state to decide between "mint new" and "return existing".
  const { data: existing, error: fetchErr } = await supabase
    .from('videos')
    .select('share_token, share_token_expires_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  // Reuse existing token unless caller asked to rotate — but only while
  // it is still valid. An expired token is rotated automatically.
  const existingExpiry = existing.share_token_expires_at as string | null
  const existingStillValid =
    !!existing.share_token && (!existingExpiry || new Date(existingExpiry).getTime() > Date.now())

  if (existingStillValid && !rotate) {
    return NextResponse.json({
      share_token: existing.share_token,
      share_token_expires_at: existingExpiry,
    })
  }

  const token = randomUUID()
  const expiresAt = expiryFromDays(expiresInDays)
  const { error: updErr } = await supabase
    .from('videos')
    .update({
      share_token: token,
      share_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }

  return NextResponse.json({ share_token: token, share_token_expires_at: expiresAt })
}

/**
 * DELETE /api/videos/:id/share
 *
 * Revokes the share token (sets it back to NULL). Idempotent — calling
 * on an already-private video succeeds silently.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: updErr, count } = await supabase
    .from('videos')
    .update(
      { share_token: null, share_token_expires_at: null, updated_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
