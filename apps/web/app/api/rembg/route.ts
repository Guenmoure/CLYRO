import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createFalClient } from '@fal-ai/client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

export async function POST(request: NextRequest) {
  try {
    // SECURITY: calls fal.ai birefnet (billable compute). Auth required.
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit('rembg', user.id, 30)
    if (!limit.allowed) return rateLimitResponse(limit)

    const { imageUrl } = await request.json() as { imageUrl: string }
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    // BiRefNet v2 — drop-in upgrade over v1 with sharper edge detection
    // for fine hair, semi-transparent objects, and motion-blur subjects.
    // Same I/O surface as v1.
    const result = await fal.subscribe('fal-ai/birefnet/v2', {
      input: { image_url: imageUrl },
    }) as any

    const url: string | undefined =
      result?.image?.url ??
      result?.data?.image?.url ??
      result?.images?.[0]?.url ??
      result?.data?.images?.[0]?.url

    if (!url) return NextResponse.json({ error: 'No result from birefnet' }, { status: 502 })

    return NextResponse.json({ url })
  } catch (err) {
    // Generic message only — err.message can leak fal.ai account details.
    console.error('[rembg]', err)
    return NextResponse.json({ error: 'Background removal failed', code: 'GENERATION_ERROR' }, { status: 500 })
  }
}
