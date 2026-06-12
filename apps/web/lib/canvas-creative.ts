/**
 * Rasterize a Creative to a PNG via a canvas — Phase 3.4 V2.5 download.
 *
 * The editor renders blocks at HTML positions (% of preview). To produce a
 * downloadable image we redraw the same composition on a canvas sized to the
 * image's natural dimensions. No new dependency — pure DOM canvas.
 *
 * Limitation : fal.ai serves images with permissive CORS, but if a CDN ever
 * stops doing so, `toDataURL` will throw with a tainted-canvas error. We
 * surface a clear message in that case.
 */

import type {
  BrandCreative, CampaignAspectRatio,
  CreativeBlockPositions, CreativeBlockSizes,
} from '@clyro/shared'

interface RasterizeOptions {
  creative:    BrandCreative
  aspectRatio: CampaignAspectRatio
  positions:   CreativeBlockPositions
  sizes:       CreativeBlockSizes
  /** Font px at the preview width — same scale used in the editor. */
  baseFontPx:  { header: number; description: number; cta: number }
  /** Preview width in px, used to scale fonts to the canvas. */
  previewWidth: number
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  fontWeight: number,
  options: { uppercase?: boolean; letterSpacing?: number; color?: 'white' | 'black' } = {},
) {
  const renderText = options.uppercase ? text.toUpperCase() : text
  ctx.font = `${fontWeight} ${fontSize}px Inter, "Plus Jakarta Sans", system-ui, sans-serif`
  // V3 : honore la couleur suggérée par Fix Layout ('white' | 'black').
  // Sans valeur, fallback blanc historique.
  const isBlack = options.color === 'black'
  ctx.fillStyle = isBlack ? '#000000' : '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = isBlack ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.7)'
  ctx.shadowBlur = fontSize * 0.35
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = fontSize * 0.08

  const maxWidth = ctx.canvas.width * 0.92
  const lines = wrapText(ctx, renderText, maxWidth)
  const lineHeight = fontSize * 1.18

  const totalHeight = lines.length * lineHeight
  lines.forEach((line, i) => {
    const lineY = y - totalHeight / 2 + lineHeight / 2 + i * lineHeight
    ctx.fillText(line, x, lineY)
  })

  // Reset shadow so it doesn't leak into subsequent drawings.
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

/** Loads an image with `crossOrigin = anonymous`. Rejects on error. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image (CORS or 404)'))
    img.src = url
  })
}

/**
 * Returns a PNG blob URL. Caller can use it to trigger a download anchor
 * and is responsible for revoking it with URL.revokeObjectURL.
 */
export async function rasterizeCreativeToPng(opts: RasterizeOptions): Promise<string> {
  const { creative, positions, sizes, baseFontPx, previewWidth } = opts
  const img = await loadImage(creative.image_url)

  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // 1. Image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // 2. Gradient overlay (same as the preview)
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0,    'rgba(0, 0, 0, 0.30)')
  grad.addColorStop(0.5,  'rgba(0, 0, 0, 0.00)')
  grad.addColorStop(1,    'rgba(0, 0, 0, 0.40)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 3. Text blocks — scale fonts by canvas.width / previewWidth so the
  //    download matches what the editor shows.
  const scale = canvas.width / previewWidth

  const blocks = creative.blocks_visible
  if (blocks.header && creative.header_text) {
    drawCenteredText(
      ctx,
      creative.header_text,
      (positions.header.x / 100) * canvas.width,
      (positions.header.y / 100) * canvas.height,
      baseFontPx.header * sizes.header * scale,
      600,
      { color: positions.header.color },
    )
  }
  if (blocks.description && creative.description_text) {
    drawCenteredText(
      ctx,
      creative.description_text,
      (positions.description.x / 100) * canvas.width,
      (positions.description.y / 100) * canvas.height,
      baseFontPx.description * sizes.description * scale,
      400,
      { color: positions.description.color },
    )
  }
  if (blocks.cta && creative.cta_text) {
    drawCenteredText(
      ctx,
      creative.cta_text,
      (positions.cta.x / 100) * canvas.width,
      (positions.cta.y / 100) * canvas.height,
      baseFontPx.cta * sizes.cta * scale,
      500,
      { uppercase: true, color: positions.cta.color },
    )
  }

  // 4. Export
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas blob export failed (likely tainted by CORS)'))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

/** Helper: triggers an anchor download for a creative. Revokes the blob URL after. */
export async function downloadCreativeAsPng(opts: RasterizeOptions & { filename: string }): Promise<void> {
  const url = await rasterizeCreativeToPng(opts)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = opts.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Give the browser a tick before revoking; some implementations cancel
    // the download otherwise.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
