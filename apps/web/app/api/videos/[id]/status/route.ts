import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
// Allow up to 5 minutes for long-running video jobs
export const maxDuration = 300

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * GET /api/videos/:id/status
 *
 * SSE proxy — forwards the EventSource stream from the Render API to the browser.
 * This avoids CORS issues when the browser is on Vercel and the API is on Render.
 *
 * The `token` query param (Supabase JWT) is validated server-side via
 * `auth.getUser(jwt)` before forwarding to the upstream Express API.
 * EventSource cannot send cookies or custom headers, so the token is
 * passed as a query param by the client.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const token = req.nextUrl.searchParams.get('token')

  // Reject missing or obviously malformed tokens before hitting Supabase.
  if (!token || token.split('.').length !== 3) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
  }

  // Validate the JWT server-side — same pattern as draft-save.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Missing config' }, { status: 500 })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  // Verify the video belongs to this user before proxying.
  const { data: video, error: videoErr } = await supabase
    .from('videos')
    .select('id')
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (videoErr || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const upstreamUrl = `${API_URL}/api/v1/videos/${id}/status?token=${encodeURIComponent(token)}`

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(upstreamUrl, {
      headers: { Accept: 'text/event-stream' },
      // @ts-expect-error — Node 18 fetch supports duplex but types lag
      duplex: 'half',
    })
  } catch (err) {
    console.error('[/api/videos/status proxy] fetch error:', err)
    return NextResponse.json({ error: 'Upstream unreachable', code: 'PROXY_ERROR' }, { status: 502 })
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await upstreamRes.text().catch(() => '')
    console.error(`[/api/videos/status proxy] upstream ${upstreamRes.status}: ${text.slice(0, 200)}`)
    return NextResponse.json(
      { error: `Upstream error ${upstreamRes.status}` },
      { status: upstreamRes.status >= 500 ? 502 : upstreamRes.status },
    )
  }

  // Stream the SSE body straight through to the browser
  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // disable Nginx buffering on Vercel edge
    },
  })
}
