import { Router, Request, Response } from 'express'
import PDFDocument from 'pdfkit'
import { logger } from '../lib/logger'
import { authMiddleware } from '../middleware/auth'

export const generatePdfRouter = Router()
generatePdfRouter.use(authMiddleware)

interface CharteColor {
  name: string
  hex: string
  usage: string
  rgb?: { r: number; g: number; b: number }
}

interface BrandCharte {
  brandName?: string
  tagline?: string
  colors: CharteColor[]
  typography: {
    heading: { font: string; weight: string; size: string }
    body: { font: string; weight: string; size: string }
    accent: { font: string; weight: string; size: string }
  }
  layout: { gridSystem: string; spacing: string; borderRadius: string }
  photography: { style: string; mood: string; filters: string[] }
  voiceGuidelines?: string
  doList?: string[]
  dontList?: string[]
}

/**
 * POST /api/v1/generate-pdf
 *
 * Génère un PDF de charte graphique (brand guide) à partir d'un objet BrandCharte.
 *
 * Body JSON :
 *   charte    BrandCharte  — la charte à exporter
 *   brandName? string      — nom de la marque (override charte.brandName)
 *
 * Réponse : application/pdf (buffer)
 */
generatePdfRouter.post('/generate-pdf', async (req: Request, res: Response) => {
  try {
    const { charte, brandName: namOverride } = req.body as {
      charte: BrandCharte
      brandName?: string
    }

    if (!charte) {
      res.status(400).json({ error: 'charte is required' })
      return
    }

    const brand = namOverride ?? charte.brandName ?? 'Brand Guide'

    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'A4', margin: 48 })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)

      // ── Cover page ──────────────────────────────────────────────────────
      doc
        .rect(0, 0, doc.page.width, doc.page.height)
        .fill('#0f0f0f')

      doc
        .fill('#ffffff')
        .fontSize(36)
        .font('Helvetica-Bold')
        .text(brand, 48, 180, { align: 'center' })

      if (charte.tagline) {
        doc
          .fill('#aaaaaa')
          .fontSize(14)
          .font('Helvetica')
          .text(charte.tagline, 48, 240, { align: 'center' })
      }

      doc
        .fill('#555555')
        .fontSize(10)
        .text('Brand Guidelines', 48, doc.page.height - 80, { align: 'center' })

      // ── Colors page ──────────────────────────────────────────────────────
      doc.addPage()
      sectionHeader(doc, 'Palette de couleurs')

      const SWATCH_SIZE = 60
      const SWATCH_GAP = 16
      const COLS = 4
      let swatchX = doc.page.margins.left
      let swatchY = doc.y + 8

      charte.colors.forEach((color, i) => {
        const col = i % COLS
        if (col === 0 && i !== 0) {
          swatchX = doc.page.margins.left
          swatchY += SWATCH_SIZE + 40
        } else if (i !== 0) {
          swatchX += SWATCH_SIZE + SWATCH_GAP + 60
        }

        // Swatch rectangle
        doc.rect(swatchX, swatchY, SWATCH_SIZE, SWATCH_SIZE).fill(color.hex)

        // Hex label
        doc
          .fill('#111111')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(color.hex.toUpperCase(), swatchX, swatchY + SWATCH_SIZE + 4, {
            width: SWATCH_SIZE + 60,
          })

        // Name
        doc
          .fill('#333333')
          .fontSize(8)
          .font('Helvetica')
          .text(color.name, swatchX, swatchY + SWATCH_SIZE + 16, { width: SWATCH_SIZE + 60 })

        // Usage
        doc
          .fill('#777777')
          .fontSize(7)
          .text(color.usage, swatchX, swatchY + SWATCH_SIZE + 26, { width: SWATCH_SIZE + 60 })
      })

      // ── Typography page ──────────────────────────────────────────────────
      doc.addPage()
      sectionHeader(doc, 'Typographie')

      const typoEntries: Array<[string, { font: string; weight: string; size: string }]> = [
        ['Titre (Heading)', charte.typography.heading],
        ['Corps de texte (Body)', charte.typography.body],
        ['Accent', charte.typography.accent],
      ]

      for (const [label, typo] of typoEntries) {
        doc
          .fill('#888888')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(label.toUpperCase(), { continued: false })

        doc
          .fill('#111111')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(typo.font)

        doc
          .fill('#555555')
          .fontSize(10)
          .font('Helvetica')
          .text(`${typo.weight} — ${typo.size}`)

        doc.moveDown(1.2)
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke('#e5e5e5')
        doc.moveDown(0.8)
      }

      // ── Layout & Photography page ───────────────────────────────────────
      doc.addPage()
      sectionHeader(doc, 'Mise en page & Photographie')

      subHeader(doc, 'Grille & Espacement')
      labelRow(doc, 'Système de grille', charte.layout.gridSystem)
      labelRow(doc, 'Espacement', charte.layout.spacing)
      labelRow(doc, 'Border radius', charte.layout.borderRadius)

      doc.moveDown(1)
      subHeader(doc, 'Style photographique')
      labelRow(doc, 'Style', charte.photography.style)
      labelRow(doc, 'Ambiance', charte.photography.mood)
      if (charte.photography.filters?.length) {
        labelRow(doc, 'Filtres', charte.photography.filters.join(', '))
      }

      // ── Do / Don't page ─────────────────────────────────────────────────
      if (charte.doList?.length || charte.dontList?.length) {
        doc.addPage()
        sectionHeader(doc, 'À faire / À éviter')

        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right
        const colW = pageW / 2 - 16

        // DO column
        doc
          .fill('#16a34a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('✓  À faire', doc.page.margins.left, doc.y, { width: colW })

        const doStartY = doc.y + 4
        for (const item of charte.doList ?? []) {
          doc.fill('#111111').fontSize(9).font('Helvetica').text(`• ${item}`, doc.page.margins.left, doc.y, { width: colW })
          doc.moveDown(0.3)
        }

        // DON'T column (right)
        const dontX = doc.page.margins.left + colW + 32
        doc
          .fill('#dc2626')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('✗  À éviter', dontX, doStartY - 4 - 15, { width: colW })

        let dontY = doStartY
        for (const item of charte.dontList ?? []) {
          doc.fill('#111111').fontSize(9).font('Helvetica').text(`• ${item}`, dontX, dontY, { width: colW })
          dontY += 18
        }
      }

      // ── Voice guidelines page ────────────────────────────────────────────
      if (charte.voiceGuidelines) {
        doc.addPage()
        sectionHeader(doc, 'Ton éditorial')
        doc
          .fill('#333333')
          .fontSize(11)
          .font('Helvetica')
          .text(charte.voiceGuidelines, { align: 'justify', lineGap: 4 })
      }

      doc.end()
    })

    const pdfBuffer = Buffer.concat(chunks)
    logger.info({ brand, size: pdfBuffer.length }, 'generate-pdf: PDF generated')

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(brand)}-brand-guide.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    })
    res.send(pdfBuffer)
  } catch (err) {
    logger.error({ err }, 'generate-pdf: failed')
    res.status(500).json({ error: err instanceof Error ? err.message : 'PDF generation failed' })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fill('#111111')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(title)
  doc.moveDown(0.3)
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke('#111111')
  doc.moveDown(1)
}

function subHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.fill('#444444').fontSize(12).font('Helvetica-Bold').text(title)
  doc.moveDown(0.4)
}

function labelRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc
    .fill('#888888')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`${label}:  `, { continued: true })
    .fill('#111111')
    .font('Helvetica')
    .text(value)
  doc.moveDown(0.3)
}
