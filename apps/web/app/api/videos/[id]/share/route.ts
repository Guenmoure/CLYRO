import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

/**
 * GET /api/videos/:id/share
 *
 * Returns the current share state for the owner's video:
 *   { share_token: string | null }
 *
 * Used by ShareLinkModal on open to render either an existing link or
 * an "Activate" CTA without minting a token speculatively.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('videos')
    .select('share_token')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json({ share_token: data.share_token ?? null })
}

/**
 * POST /api/videos/:id/share
 *
 * Mints a new share_token (or rotates an existing one if `?rotate=1`).
 * Returns { share_token }.
 *
 * The token is generated server-side via crypto.randomUUID() — opaque
 * and unguessable, used as-is in the public URL /share/[token].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rotate = req.nextUrl.searchParams.get('rotate') === '1'

  // Fetch current state to decide between "mint new" and "return existing".
  const { data: existing, error: fetchErr } = await supabase
    .from('videos')
    .select('share_token')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  // Reuse existing token unless caller asked to rotate.
  if (existing.share_token && !rotate) {
    return NextResponse.json({ share_token: existing.share_token })
  }

  const token = randomUUID()
  const { error: updErr } = await supabase
    .from('videos')
    .update({ share_token: token, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }

  return NextResponse.json({ share_token: token })
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
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: updErr, count } = await supabase
    .from('videos')
    .update({ share_token: null, updated_at: new Date().toISOString() }, { count: 'exact' })
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
