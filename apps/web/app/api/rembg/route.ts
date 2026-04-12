import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'

const fal = createFalClient({ credentials: process.env.FAL_KEY })

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json() as { imageUrl: string }
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const result = await fal.subscribe('fal-ai/birefnet', {
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
    console.error('[rembg]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'rembg failed' }, { status: 500 })
  }
}
