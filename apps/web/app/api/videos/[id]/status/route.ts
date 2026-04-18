import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Allow up to 5 minutes for long-running video jobs
export const maxDuration = 300

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * GET /api/videos/:id/status
 *
 * SSE proxy — forwards the EventSource stream from the Render API to the browser.
 * This avoids CORS issues when the browser is on Vercel and the API is on Render.
 *
 * The `token` query param (Supabase JWT) is forwarded as-is to the upstream API.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
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
    const msg = err instanceof Error ? err.message : 'Upstream unreachable'
    console.error('[/api/videos/status proxy] fetch error:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
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
