import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { BrandBrief, BrandDirection, BrandCharte } from '@clyro/shared'
import { buildCharteHtml } from '@/lib/brand-charte-html'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

async function fetchAsset(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// Minimal ZIP builder — no external deps, uses Node.js built-ins only
function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const centralDirs: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')

    const localHeader = Buffer.alloc(30 + name.length)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(0, 14)
    localHeader.writeUInt32LE(file.data.length, 18)
    localHeader.writeUInt32LE(file.data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)
    name.copy(localHeader, 30)

    const centralDir = Buffer.alloc(46 + name.length)
    centralDir.writeUInt32LE(0x02014b50, 0)
    centralDir.writeUInt16LE(20, 4)
    centralDir.writeUInt16LE(20, 6)
    centralDir.writeUInt16LE(0, 8)
    centralDir.writeUInt16LE(0, 10)
    centralDir.writeUInt16LE(0, 12)
    centralDir.writeUInt16LE(0, 14)
    centralDir.writeUInt32LE(0, 16)
    centralDir.writeUInt32LE(file.data.length, 20)
    centralDir.writeUInt32LE(file.data.length, 24)
    centralDir.writeUInt16LE(name.length, 28)
    centralDir.writeUInt16LE(0, 30)
    centralDir.writeUInt16LE(0, 32)
    centralDir.writeUInt16LE(0, 34)
    centralDir.writeUInt16LE(0, 36)
    centralDir.writeUInt32LE(0, 38)
    centralDir.writeUInt32LE(offset, 42)
    name.copy(centralDir, 46)

    parts.push(localHeader, file.data)
    centralDirs.push(centralDir)
    offset += localHeader.length + file.data.length
  }

  const centralDirBuf = Buffer.concat(centralDirs)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDirBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...parts, centralDirBuf, eocd])
}

const ASSET_FILENAMES: Record<string, string> = {
  logo_url:             'logos/logo-light.png',
  logo_dark_url:        'logos/logo-dark.png',
  mockup_business_card: 'mockups/business-card.png',
  mockup_social_post:   'mockups/social-post.png',
  mockup_email_header:  'mockups/email-header.png',
  mockup_letterhead:    'mockups/letterhead.png',
  mockup_packaging:     'mockups/packaging.png',
  lifestyle_mockup:     'mockups/lifestyle.png',
  pattern_url:          'assets/pattern.png',
  illustration_url:     'assets/illustration.png',
  brand_banner:         'assets/banner.png',
  og_image_url:         'assets/og-image.png',
}

// 1 year signed URL expiry
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      brief: BrandBrief
      direction: BrandDirection
      charte: BrandCharte
      assets: Record<string, string | undefined>
      logoUrl?: string
      userId?: string
      userEmail?: string
      share?: boolean
    }
    const { brief, direction, charte, assets, logoUrl, userId, share } = body

    const slug = brief.name.toLowerCase().replace(/\s+/g, '-')

    const entries: Array<{ path: string; url: string }> = []
    if (logoUrl) entries.push({ path: `logos/${slug}-logo-selected.png`, url: logoUrl })

    for (const [key, filename] of Object.entries(ASSET_FILENAMES)) {
      const url = assets[key]
      if (url) entries.push({ path: `${slug}/${filename}`, url })
    }

    // Download in parallel (max 10 concurrent)
    const downloads = await Promise.all(
      entries.map(async (e) => ({ name: e.path, data: await fetchAsset(e.url) }))
    )
    const validFiles = downloads.filter((f): f is { name: string; data: Buffer } => f.data !== null)

    // palette.json
    const paletteJson = JSON.stringify({
      brand: brief.name,
      direction: direction.name,
      tagline: direction.tagline,
      palette: direction.palette,
      typography: direction.typography,
      keywords: direction.keywords,
    }, null, 2)
    validFiles.push({ name: `${slug}/palette.json`, data: Buffer.from(paletteJson, 'utf8') })

    // charte-summary.txt
    const summary = [
      `CHARTE GRAPHIQUE — ${brief.name}`,
      `Direction : ${direction.name}`,
      `Tagline : ${direction.tagline}`,
      `Secteur : ${brief.secteur} · Cible : ${brief.cible}`,
      '',
      'PALETTE :',
      ...(charte.colors ?? []).map((c) => `  ${c.name} : ${c.hex}  (${c.rgb})  — ${c.usage}`),
      '',
      'TYPOGRAPHIE :',
      `  Titres : ${charte.typography?.heading?.font ?? direction.typography.heading}  ${charte.typography?.heading?.weight ?? ''}`,
      `  Corps  : ${charte.typography?.body?.font ?? direction.typography.body}  ${charte.typography?.body?.weight ?? ''}`,
      '',
      'LOGO :',
      `  Espace protection : ${charte.logo_rules?.clear_space ?? '—'}`,
      `  Fonds autorisés   : ${charte.logo_rules?.allowed_backgrounds?.join(', ') ?? '—'}`,
      `  Interdits         : ${charte.logo_rules?.forbidden?.join(', ') ?? '—'}`,
      '',
      `Généré avec CLYRO — ${new Date().toISOString().split('T')[0]}`,
    ].join('\n')
    validFiles.push({ name: `${slug}/charte-summary.txt`, data: Buffer.from(summary, 'utf8') })

    // charte.html — full styled brand charter (fallback / editable)
    const charteHtml = buildCharteHtml(brief, direction, charte, logoUrl)
    validFiles.push({ name: `${slug}/charte.html`, data: Buffer.from(charteHtml, 'utf8') })

    // charte.pdf — server-side PDF generation via internal API call
    try {
      const pdfRes = await fetch(new URL('/api/brand-pdf', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, direction, charte, logoUrl }),
      })
      if (pdfRes.ok) {
        const contentType = pdfRes.headers.get('content-type') ?? ''
        const pdfData = Buffer.from(await pdfRes.arrayBuffer())
        // Only include if it's actually a PDF (not fallback HTML)
        if (contentType.includes('application/pdf')) {
          validFiles.push({ name: `${slug}/charte.pdf`, data: pdfData })
        }
      }
    } catch (pdfErr) {
      console.warn('[brand-zip] PDF generation failed, ZIP will include HTML only:', pdfErr)
    }

    // README.md — quick start guide
    const readme = [
      `# ${brief.name} — Brand Kit`,
      '',
      `> ${direction.tagline}`,
      '',
      '## Contenu',
      '',
      '| Dossier | Description |',
      '|---------|-------------|',
      '| `logos/` | Logo principal dans différentes variantes |',
      '| `mockups/` | Mises en situation (carte de visite, réseaux sociaux, packaging…) |',
      '| `assets/` | Patterns, illustrations, bannières |',
      '| `palette.json` | Palette couleurs + typographie au format JSON |',
      '| `charte.pdf` | Charte graphique complète (PDF) |',
      '| `charte.html` | Charte graphique éditable (HTML) |',
      '',
      '## Palette rapide',
      '',
      `- **Primaire :** \`${direction.palette.primary}\``,
      `- **Secondaire :** \`${direction.palette.secondary}\``,
      `- **Accent :** \`${direction.palette.accent}\``,
      '',
      '## Typographie',
      '',
      `- **Titres :** ${direction.typography.heading}`,
      `- **Corps :** ${direction.typography.body}`,
      '',
      '---',
      `Généré avec [CLYRO](https://clyro.ai) · ${new Date().toLocaleDateString('fr-FR')}`,
    ].join('\n')
    validFiles.push({ name: `${slug}/README.md`, data: Buffer.from(readme, 'utf8') })

    const zipBuffer = buildZip(validFiles)

    // ── Share mode: upload to Supabase and return signed URL ──────────────────
    if (share && userId) {
      const supabase = supabaseAdmin()
      const storagePath = `${userId}/brand-kits/${slug}-${Date.now()}.zip`

      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, zipBuffer, { contentType: 'application/zip', upsert: true })

      if (uploadError) {
        console.error('[brand-zip] upload error', uploadError)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }

      const { data: signed } = await supabase.storage
        .from('brand-assets')
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY)

      if (!signed?.signedUrl) {
        return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
      }

      // Send notification email if user email is provided
      if (body.userEmail) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
        fetch(`${apiUrl}/api/v1/notify/brand-kit-ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: body.userEmail,
            brandName: brief.name,
            downloadUrl: signed.signedUrl,
          }),
        }).catch((err) => console.warn('[brand-zip] email notification failed:', err))
      }

      return NextResponse.json({ signedUrl: signed.signedUrl, filename: `${slug}-brand-kit.zip` })
    }

    // ── Default: stream ZIP as download ──────────────────────────────────────
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug}-brand-kit.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch (err) {
    console.error('[brand-zip]', err)
    return NextResponse.json({ error: 'ZIP generation failed' }, { status: 500 })
  }
}
