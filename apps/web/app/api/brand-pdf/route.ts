import { NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import type { BrandBrief, BrandDirection, BrandCharte } from '@clyro/shared'
import { buildCharteHtml } from '@/lib/brand-charte-html'
import { z } from 'zod'

const bodySchema = z.object({
  brief:     z.record(z.string(), z.unknown()),
  direction: z.record(z.string(), z.unknown()),
  charte:    z.record(z.string(), z.unknown()),
  logoUrl:   z.string().url().optional(),
})

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/brand-pdf
 *
 * Generates a PDF from the brand charter HTML.
 * Uses puppeteer-core + @sparticuz/chromium for serverless PDF generation.
 * Falls back to HTML if Chromium is unavailable (e.g., local dev).
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: spins up serverless Chromium for PDF rendering (compute
    // cost) and accepts arbitrary HTML via the brand charter builder.
    // Authentication required.
    const supabase = createSSRClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const { brief, direction, charte, logoUrl } = parsed.data as unknown as {
      brief: BrandBrief; direction: BrandDirection; charte: BrandCharte; logoUrl?: string
    }
    const slug = brief.name.toLowerCase().replace(/\s+/g, '-')

    const html = buildCharteHtml(brief, direction, charte, logoUrl)

    // Try server-side PDF generation with Puppeteer
    try {
      const chromium = await import('@sparticuz/chromium').then(m => m.default)
      const puppeteer = await import('puppeteer-core').then(m => m.default)

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 900 },
        executablePath: await chromium.executablePath(),
        headless: true,
      })

      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
      })
      await browser.close()
      const pdfBuffer = Buffer.from(pdfUint8)

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="charte-${slug}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      })
    } catch (puppeteerErr) {
      // Puppeteer not available — fall back to HTML download
      console.warn('[brand-pdf] Puppeteer unavailable, falling back to HTML:', puppeteerErr)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="charte-${slug}.html"`,
        },
      })
    }
  } catch (err) {
    console.error('[brand-pdf]', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}

