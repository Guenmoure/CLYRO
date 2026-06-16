import { NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const regenScenePromptsSchema = z.object({
  scriptText: z.string().min(1),
  style:      z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createSSRClient()
    // getUser() revalidates the JWT with the Supabase Auth server (getSession
    // only trusts the local cookie). getSession is then used solely to read
    // the access_token forwarded to apps/api — never for authentication.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const parsed = regenScenePromptsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const res = await fetch(`${API_URL}/api/v1/generate/regen-scene-prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(parsed.data),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[regen-scene-prompts proxy]', err)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
