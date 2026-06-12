import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  // Chaque appel = 2 requêtes fal.ai (birefnet + flux/dev) → quota serré.
  const limit = checkRateLimit('brand-background', user.id, 20)
  if (!limit.allowed) return rateLimitResponse(limit)

  const body = await req.json()
  const { source_image_url, background_prompt, brand_kit_id } = body

  if (!source_image_url || !background_prompt) {
    return NextResponse.json({ error: 'source_image_url and background_prompt required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  let brandSuffix = ''
  if (brand_kit_id) {
    const { data: kit } = await supabase
      .from('brand_kits')
      .select('primary_color, secondary_color')
      .eq('id', brand_kit_id)
      .eq('user_id', user.id)
      .single()
    if (kit) {
      brandSuffix = `, brand color palette: ${kit.primary_color}${kit.secondary_color ? ` and ${kit.secondary_color}` : ''}`
    }
  }

  const FAL_KEY = process.env.FAL_KEY
  if (!FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured', code: 'CONFIG_ERROR' }, { status: 500 })
  }

  try {
    // Step 1: Remove background
    const rembgRes = await fetch('https://queue.fal.run/fal-ai/birefnet', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: source_image_url }),
    })

    if (!rembgRes.ok) throw new Error('Background removal failed')
    const rembgData = await rembgRes.json()
    const foregroundUrl = rembgData.image?.url ?? rembgData.images?.[0]?.url

    if (!foregroundUrl) throw new Error('No foreground image returned')

    // Step 2: Generate new background
    const bgPrompt = `${background_prompt}, professional product photography background, clean composition with space for product placement in center${brandSuffix}, 8K quality`

    const bgRes = await fetch('https://queue.fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: bgPrompt,
        image_size: { width: 1024, height: 1024 },
        num_inference_steps: 28,
        num_images: 1,
      }),
    })

    if (!bgRes.ok) throw new Error('Background generation failed')
    const bgData = await bgRes.json()
    const backgroundUrl = bgData.images?.[0]?.url

    if (!backgroundUrl) throw new Error('No background image returned')

    return NextResponse.json({
      foreground_url: foregroundUrl,
      background_url: backgroundUrl,
      composite_prompt: bgPrompt,
    })
  } catch (err) {
    console.error('[brand-background] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Background edit failed', code: 'GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
