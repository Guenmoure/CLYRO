/**
 * Brand Book PDF renderer — Phase 5 V2 (server-side PDF).
 *
 * Génère un PDF complet et autonome à partir d'un Brand Kit, via pdfkit.
 * Approche programmatique (pas de Puppeteer / Chromium) :
 *   • pdfkit pèse ~600 KB et fait du PDF natif déterministe
 *   • le style se rapproche du template HTML (cover en brand color, sections
 *     titre + body, chips pour values / aesthetic / tone, palette en
 *     swatches, footer)
 *   • si le logo du kit est une URL distante, on tente de le télécharger
 *     (3 s timeout, plafond 2 MB) — sinon on tombe sur un monogramme.
 *
 * Le rendu est INTENTIONNELLEMENT plus sobre que l'HTML : pdfkit ne supporte
 * pas le CSS ni les fonts Web. C'est un livrable PDF strict, complémentaire
 * au print-to-PDF browser (qui lui peut tomber les images CSS).
 */

import PDFDocument from 'pdfkit'
import { logger } from '../lib/logger'

export interface BrandBookPdfInput {
  name:                string
  url?:                string | null
  tagline?:            string | null
  primary_color:       string
  secondary_color?:    string | null
  font_family?:        string | null
  logo_url?:           string | null
  brand_values?:       string[] | null
  brand_aesthetic?:    string[] | null
  brand_tone_of_voice?: string[] | null
  business_overview?:  string | null
  version:             number
}

const PAGE_WIDTH  = 595.28  // A4 portrait, points
const PAGE_HEIGHT = 841.89
const SIDE_MARGIN = 56
const CONTENT_W   = PAGE_WIDTH - SIDE_MARGIN * 2

const INK   = '#1a1a1a'
const MUTED = '#6b6b6b'
const BG    = '#fafaf7'

/** Fetch une image (3 s timeout, ≤ 2 MB) et la retourne en Buffer.
 *  Si quoi que ce soit échoue on retourne null — le caller fait fallback. */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return null
      const ctype = (res.headers.get('content-type') ?? '').toLowerCase()
      if (!ctype.startsWith('image/')) return null
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > 2 * 1024 * 1024) return null
      return buf
    } finally {
      clearTimeout(t)
    }
  } catch {
    return null
  }
}

/** Dessine une chip rounded-rect avec son texte centré. Retourne la
 *  largeur consommée (pour permettre au caller de gérer un wrap manuel). */
function drawChip(doc: PDFKit.PDFDocument, text: string, x: number, y: number): number {
  doc.font('Helvetica').fontSize(10)
  const textW = doc.widthOfString(text)
  const padX  = 12
  const padY  = 6
  const w = textW + padX * 2
  const h = 24
  doc
    .save()
    .lineWidth(0.75)
    .roundedRect(x, y, w, h, h / 2)
    .stroke(INK)
    .restore()
  doc
    .fillColor(INK)
    .text(text, x + padX, y + padY + 0.5, { lineBreak: false, width: textW })
  return w
}

/** Layout les chips en lignes avec wrap. Retourne le y final. */
function drawChipRow(doc: PDFKit.PDFDocument, tags: string[], startX: number, startY: number): number {
  const gap = 6
  let x = startX
  let y = startY
  for (const tag of tags) {
    doc.font('Helvetica').fontSize(10)
    const textW = doc.widthOfString(tag) + 24
    if (x + textW > SIDE_MARGIN + CONTENT_W) {
      x = startX
      y += 30
    }
    drawChip(doc, tag, x, y)
    x += textW + gap
  }
  return y + 24
}

/** Section eyebrow + title — réutilisé partout. */
function drawSectionHeader(doc: PDFKit.PDFDocument, eyebrow: string, title: string, topY: number): number {
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text(eyebrow.toUpperCase(), SIDE_MARGIN, topY, { characterSpacing: 1.5 })
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(28)
    .text(title, SIDE_MARGIN, topY + 24, { width: CONTENT_W })
  return doc.y + 16
}

/** Trace un séparateur horizontal subtil. */
function drawDivider(doc: PDFKit.PDFDocument, y: number) {
  doc
    .save()
    .moveTo(SIDE_MARGIN, y)
    .lineTo(SIDE_MARGIN + CONTENT_W, y)
    .lineWidth(0.5)
    .stroke('#e0e0d8')
    .restore()
}

/** Logo : si on a réussi à fetch l'image, on la dessine ; sinon monogramme. */
function drawLogoCell(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, logoBuf: Buffer | null, name: string, bgColor: string, fgColor: string) {
  doc.save().rect(x, y, w, h).fill(bgColor).restore()
  if (logoBuf) {
    try {
      const imgW = w * 0.6
      const imgH = h * 0.6
      doc.image(logoBuf, x + (w - imgW) / 2, y + (h - imgH) / 2, { fit: [imgW, imgH], align: 'center', valign: 'center' })
      return
    } catch {
      // tombe sur le monogramme
    }
  }
  const initial = (name.trim().charAt(0) || '·').toUpperCase()
  doc
    .fillColor(fgColor)
    .font('Helvetica-Bold')
    .fontSize(48)
    .text(initial, x, y + (h - 48) / 2, { width: w, align: 'center' })
}

/**
 * Génère le PDF complet pour un Brand Kit donné. Retourne un Buffer prêt
 * à être envoyé en HTTP. Lève si pdfkit explose, ce qui est rare — le
 * routeur appelant capture pour renvoyer 500.
 */
export async function renderBrandBookPdf(input: BrandBookPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size:    [PAGE_WIDTH, PAGE_HEIGHT],
    margin:  0,
    info: {
      Title:    `${input.name} — Brand Book v${input.version}`,
      Author:   input.name,
      Producer: 'CLYRO',
      Creator:  'CLYRO Brand Book',
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const logoBuf = input.logo_url ? await fetchImageBuffer(input.logo_url) : null
  if (input.logo_url && !logoBuf) {
    logger.info({ logo: input.logo_url }, 'Brand book PDF: logo fetch failed, falling back to monogram')
  }

  // ── COVER ─────────────────────────────────────────────────────────────────
  doc
    .save()
    .rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    .fill(input.primary_color)
    .restore()
  doc
    .fillColor('#ffffff')
    .font('Helvetica')
    .fontSize(10)
    .text(`BRAND BOOK · v${input.version}`,
      SIDE_MARGIN, 80, { characterSpacing: 2 })
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(56)
    .text(input.name, SIDE_MARGIN, 200, {
      width: CONTENT_W,
      lineGap: -10,
    })
  if (input.tagline) {
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Oblique')
      .fontSize(20)
      .text(`“${input.tagline}”`, SIDE_MARGIN, doc.y + 24, {
        width: CONTENT_W * 0.85,
      })
  }
  if (input.url) {
    doc
      .fillColor('#ffffff')
      .font('Helvetica')
      .fontSize(10)
      .text(input.url, SIDE_MARGIN, PAGE_HEIGHT - 80, { characterSpacing: 1 })
  }

  // ── LOGO PAGE ─────────────────────────────────────────────────────────────
  doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
  doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
  let y = drawSectionHeader(doc, '01 — Logo', 'Mark & clear space', 80)
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(11)
    .text(
      `The brand mark is the keystone of ${input.name}'s visual identity. Always preserve a clear space equal to the height of the mark on every side, and never reproduce it at less than 24 px tall.`,
      SIDE_MARGIN, y, { width: CONTENT_W, align: 'left' },
    )
  y = doc.y + 24

  const cellW = (CONTENT_W - 12) / 2
  const cellH = 140
  drawLogoCell(doc, SIDE_MARGIN, y, cellW, cellH, logoBuf, input.name, '#ffffff', INK)
  drawLogoCell(doc, SIDE_MARGIN + cellW + 12, y, cellW, cellH, logoBuf, input.name, '#111111', '#ffffff')
  doc
    .fillColor(MUTED).font('Helvetica').fontSize(9)
    .text('On light surfaces', SIDE_MARGIN, y + cellH + 8, { width: cellW, align: 'center' })
    .text('On dark surfaces',  SIDE_MARGIN + cellW + 12, y + cellH + 8, { width: cellW, align: 'center' })

  drawLogoCell(doc, SIDE_MARGIN, y + cellH + 40, cellW, cellH, logoBuf, input.name, input.primary_color, '#ffffff')
  if (input.secondary_color) {
    drawLogoCell(doc, SIDE_MARGIN + cellW + 12, y + cellH + 40, cellW, cellH, logoBuf, input.name, input.secondary_color, '#ffffff')
  }
  doc
    .fillColor(MUTED).font('Helvetica').fontSize(9)
    .text('On the brand colour', SIDE_MARGIN, y + cellH * 2 + 48, { width: cellW, align: 'center' })
  if (input.secondary_color) {
    doc.text('On the secondary colour', SIDE_MARGIN + cellW + 12, y + cellH * 2 + 48, { width: cellW, align: 'center' })
  }

  // ── PALETTE ───────────────────────────────────────────────────────────────
  doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
  doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
  y = drawSectionHeader(doc, '02 — Palette', 'Colour', 80)
  doc
    .fillColor(MUTED).font('Helvetica').fontSize(11)
    .text(
      `Use ${input.name}'s primary colour for the dominant brand surface, accents and CTA buttons. The secondary is for supporting moments and never as a primary background.`,
      SIDE_MARGIN, y, { width: CONTENT_W },
    )
  y = doc.y + 24

  const swatchW = (CONTENT_W - 24) / 2
  const swatchH = 86
  const swatches = [
    { color: input.primary_color, label: `Primary · ${input.primary_color.toUpperCase()}`, fg: '#ffffff' },
    ...(input.secondary_color
      ? [{ color: input.secondary_color, label: `Secondary · ${input.secondary_color.toUpperCase()}`, fg: '#ffffff' }]
      : []),
    { color: '#fafaf7', label: 'Surface · #FAFAF7', fg: INK },
    { color: '#1a1a1a', label: 'Ink · #1A1A1A',    fg: '#ffffff' },
  ]
  swatches.forEach((s, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const sx = SIDE_MARGIN + col * (swatchW + 24)
    const sy = y + row * (swatchH + 12)
    doc.save().rect(sx, sy, swatchW, swatchH).fill(s.color).restore()
    if (s.color === '#fafaf7') {
      doc.save().lineWidth(0.5).rect(sx, sy, swatchW, swatchH).stroke('#e0e0d8').restore()
    }
    doc
      .fillColor(s.fg).font('Helvetica').fontSize(11)
      .text(s.label, sx + 16, sy + swatchH - 26, { characterSpacing: 1 })
  })

  // ── TAGLINE ───────────────────────────────────────────────────────────────
  if (input.tagline) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
    doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
    y = drawSectionHeader(doc, '03 — Tagline', 'In one line', 80)
    doc
      .fillColor(INK)
      .font('Helvetica-Oblique')
      .fontSize(40)
      .text(`“${input.tagline}”`, SIDE_MARGIN, y + 32, {
        width: CONTENT_W,
        lineGap: 4,
      })
    drawDivider(doc, doc.y + 32)
    doc
      .fillColor(MUTED).font('Helvetica').fontSize(11)
      .text(
        'The tagline appears on the cover, hero placements and any key brand moment. Keep it spaced and never break the line.',
        SIDE_MARGIN, doc.y + 24, { width: CONTENT_W },
      )
  }

  // ── VALUES ────────────────────────────────────────────────────────────────
  if (input.brand_values && input.brand_values.length > 0) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
    doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
    y = drawSectionHeader(doc, '04 — Values', 'What we stand for', 80)
    drawChipRow(doc, input.brand_values, SIDE_MARGIN, y + 16)
  }

  // ── AESTHETIC ─────────────────────────────────────────────────────────────
  if (input.brand_aesthetic && input.brand_aesthetic.length > 0) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
    doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
    y = drawSectionHeader(doc, '05 — Aesthetic', 'Visual register', 80)
    doc
      .fillColor(MUTED).font('Helvetica').fontSize(11)
      .text(
        'The aesthetic guides every visual decision — palette beyond the primary, type pairing, image direction, animation feel.',
        SIDE_MARGIN, y, { width: CONTENT_W },
      )
    drawChipRow(doc, input.brand_aesthetic, SIDE_MARGIN, doc.y + 24)
  }

  // ── TONE OF VOICE ─────────────────────────────────────────────────────────
  if (input.brand_tone_of_voice && input.brand_tone_of_voice.length > 0) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
    doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
    y = drawSectionHeader(doc, '06 — Tone of voice', 'How we sound', 80)
    doc
      .fillColor(MUTED).font('Helvetica').fontSize(11)
      .text(
        `Whether it's a button, an email, a video script or a press release — the writing carries the same posture.`,
        SIDE_MARGIN, y, { width: CONTENT_W },
      )
    drawChipRow(doc, input.brand_tone_of_voice, SIDE_MARGIN, doc.y + 24)
  }

  // ── BUSINESS OVERVIEW ─────────────────────────────────────────────────────
  if (input.business_overview) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 })
    doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG).restore()
    y = drawSectionHeader(doc, '07 — Business overview', 'The company in a paragraph', 80)
    doc
      .fillColor(INK)
      .font('Helvetica')
      .fontSize(13)
      .text(input.business_overview, SIDE_MARGIN, y, {
        width: CONTENT_W,
        lineGap: 4,
      })
  }

  // ── FOOTER (sur la dernière page seulement) ───────────────────────────────
  doc
    .fillColor(MUTED).font('Helvetica').fontSize(9)
    .text(
      `Brand Book v${input.version} · Generated with CLYRO`,
      SIDE_MARGIN, PAGE_HEIGHT - 40,
      { width: CONTENT_W, align: 'right' },
    )

  // ── End + collect ─────────────────────────────────────────────────────────
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
