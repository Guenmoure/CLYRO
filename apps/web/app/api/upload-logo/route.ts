import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
// Whitelist d'extensions cohérente avec ALLOWED_TYPES — l'extension vient du
// nom de fichier CLIENT, donc jamais de confiance aveugle (path traversal,
// .html stocké servi avec une URL signée, etc.).
const ALLOWED_EXTENSIONS = new Set(['png', 'svg', 'jpg', 'jpeg', 'webp'])

export async function POST(request: NextRequest) {
  try {
    // Auth check — getUser() revalide le JWT côté serveur Supabase
    // (getSession ne fait que lire le cookie local).
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Type non supporté. Utilisez PNG, SVG, JPG ou WebP.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Le fichier ne doit pas dépasser 5 Mo' }, { status: 400 })
    }

    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Extension non supportée. Utilisez PNG, SVG, JPG, JPEG ou WebP.', code: 'INVALID_FILE_EXTENSION' },
        { status: 400 }
      )
    }
    const storagePath = `logos/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = supabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-logo] storage error:', uploadError)
      return NextResponse.json({ error: 'Upload échoué' }, { status: 500 })
    }

    const { data: signedUrl } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year

    if (!signedUrl?.signedUrl) {
      return NextResponse.json({ error: 'Impossible de créer l\'URL signée' }, { status: 500 })
    }

    return NextResponse.json({ url: signedUrl.signedUrl })
  } catch (err) {
    console.error('[upload-logo]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
