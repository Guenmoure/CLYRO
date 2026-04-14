import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const wantsStream = request.headers.get('accept')?.includes('text/event-stream')

    const res = await fetch(`${API_URL}/api/v1/generate/brand-charte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: wantsStream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })

    if (wantsStream && res.body) {
      return new NextResponse(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[brand-charte proxy]', err)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
