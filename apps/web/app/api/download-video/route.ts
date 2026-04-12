import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const videoId = searchParams.get('id')

    if (!videoId) {
      return NextResponse.json({ error: 'Missing video id' }, { status: 400 })
    }

    // Vérification session
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Requête Supabase directe — pas de dépendance au backend Express
    // Le filtre user_id garantit que l'utilisateur ne peut télécharger que ses propres vidéos
    const { data: video, error: dbError } = await supabase
      .from('videos')
      .select('output_url, title')
      .eq('id', videoId)
      .eq('user_id', session.user.id)
      .single()

    if (dbError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (!video.output_url) {
      return NextResponse.json({ error: 'No video URL available yet' }, { status: 404 })
    }

    // Téléchargement côté serveur — pas de restrictions CORS
    const fileRes = await fetch(video.output_url)

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch video file' }, { status: 502 })
    }

    const safeFilename = (video.title ?? 'video').replace(/[^a-z0-9\-_. ]/gi, '_') + '.mp4'

    return new NextResponse(fileRes.body, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[download-video]', err)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
