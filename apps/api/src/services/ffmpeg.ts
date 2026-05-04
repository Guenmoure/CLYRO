import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { writeFile, readFile, unlink, mkdir, rm, copyFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'
import type { WordTimestamp } from './elevenlabs'

/**
 * Normalise le volume audio (EBU R128 loudnorm) en deux passes.
 * Pass 1 : mesure integrated loudness, true peak, LRA
 * Pass 2 : applique la correction pour atteindre -16 LUFS (standard broadcast/streaming)
 */
export async function normalizeAudioLoudness(
  inputPath: string,
  outputPath: string,
  targetLufs: number = -16,
): Promise<void> {
  // Pass 1 : mesure (output vers /dev/null, stats dans stderr)
  const stats = await runFFmpegWithOutput([
    '-i', inputPath,
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
    '-f', 'null', '/dev/null',
  ])

  // Parse measured values from stderr JSON
  const jsonMatch = stats.match(/\{[^}]*"input_i"[^}]*\}/s)
  let loudnormFilter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`

  if (jsonMatch) {
    try {
      const measured = JSON.parse(jsonMatch[0])
      loudnormFilter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
    } catch {
      logger.warn('loudnorm: failed to parse pass 1 stats, using single-pass mode')
    }
  }

  // Pass 2 : applique la correction
  await runFFmpeg([
    '-i', inputPath,
    '-af', loudnormFilter,
    '-c:a', 'aac', '-b:a', '192k',
    outputPath,
  ])
}

/**
 * Exécute une commande ffmpeg et retourne stderr (pour analyse des stats loudnorm)
 */
async function runFFmpegWithOutput(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      // Code 0 or non-zero is fine for measurement pass
      resolve(stderr)
    })

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })
  })
}

/**
 * Exécute une commande ffmpeg et retourne stderr/stdout
 * Utilise child_process.spawn (jamais exec pour éviter injection shell)
 */
async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        logger.error({ code, stderr: stderr.slice(-2000) }, 'FFmpeg error')
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      }
    })

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })
  })
}

// ── Ken Burns via FFmpeg zoompan ───────────────────────────────────────────

// Output at assembly re-encode target → no downstream re-encode needed (stream copy).
// Upgraded from 720p → 1080p to close the gap vs Zebracat/HeyGen (competitive audit 10/10
// on export quality). Storage/bandwidth ~2× but perceived quality bump is significant.
const FORMAT_DIMS_KB = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
}

// Ken Burns presets — 6 variants rotated by scene index.
//
// IMPORTANT: zoom is computed from the normalised frame index `on/d`
// so the motion travels the FULL range across the clip's actual
// duration. The previous formula (`min(zoom+0.0015,1.20)`) only
// advanced ~0.003 over a 5-second clip at 30 fps — visually static,
// hence the user-reported "jerky / not smooth" zoom.
//
// Travel range = 0.10 (1.00 → 1.10) — enough to feel like a slow
// dolly-in without going so wide that the crop shows soft edges.
// `direction` field: 1 = zoom-in (start at 1.00, end at 1.10),
//                   -1 = zoom-out (start at 1.10, end at 1.00).
//
// `x` / `y` use `zoom` (the current value) so the pan tracks the
// scaled frame correctly throughout the motion.
const KB_TRAVEL = 0.10
const KB_FFMPEG_PRESETS = [
  // 0 — slow center zoom-in
  { z: `1+${KB_TRAVEL}*on/(d-1)`,         x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  // 1 — top-left push (Ken Burns classic)
  { z: `1+${KB_TRAVEL}*on/(d-1)`,         x: '0',                y: '0' },
  // 2 — right-pan zoom
  { z: `1+${KB_TRAVEL}*on/(d-1)`,         x: 'iw-iw/zoom',       y: 'ih/2-(ih/zoom/2)' },
  // 3 — top-pan zoom
  { z: `1+${KB_TRAVEL}*on/(d-1)`,         x: 'iw/2-(iw/zoom/2)', y: '0' },
  // 4 — slow zoom-OUT (start zoomed, end full frame)
  { z: `1+${KB_TRAVEL}-${KB_TRAVEL}*on/(d-1)`, x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  // 5 — diagonal pan + zoom
  { z: `1+${KB_TRAVEL}*on/(d-1)`,         x: 'iw-iw/zoom',       y: 'ih-ih/zoom' },
]

// Default font for drawtext overlays. `fonts-liberation` is installed in the
// Docker image (see apps/api/Dockerfile), so this path is present on Render.
// macOS dev fallback is handled via the FALLBACK below. Ubuntu/WSL dev boxes
// that lack the Liberation package will silently drop overlays (ffmpeg logs a
// warning) rather than fail the whole render.
const DRAWTEXT_FONT_PRIMARY  = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
const DRAWTEXT_FONT_FALLBACK = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' // macOS

/**
 * Escape text for ffmpeg drawtext: any character in [\ : ' %] must be backslash-
 * escaped, and single quotes cannot appear inside a single-quoted token so we
 * split them with '\''.
 *
 * ffmpeg also treats `:` and `\` specially inside the `text=...` option.
 * We strip control chars and collapse whitespace so a careless multiline
 * overlay doesn't break the filter graph.
 */
function escapeDrawtext(raw: string): string {
  const cleaned = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Backslash-escape ffmpeg metacharacters, then split single quotes out of the
  // quoted token.
  return cleaned
    .replace(/\\/g, '\\\\')
    .replace(/:/g,  '\\:')
    .replace(/%/g,  '\\%')
    .replace(/'/g,  "'\\''")
}

// ── Scene overlay (programmatic text burn) ─────────────────────────────────
// Used when a stat/title/quote/CTA must render pixel-perfect on top of an
// image or clip — diffusion models (Flux, Ideogram) cannot be trusted to
// render readable text, so we burn it in post via drawtext.

export type OverlayPosition =
  | 'top-center'    | 'top-left'    | 'top-right'
  | 'center'
  | 'bottom-center' | 'bottom-left' | 'bottom-right'

/**
 * Overlay emphasis presets — drives font size + box colour + line spacing.
 * Aligned with the 6 spec types (CLYRO_TEXT_AND_PROMPTS):
 *   - stat       — big number callout (~14% of height, dramatic box)
 *   - headline   — section title at the top (~10% of height, solid box)
 *   - title      — alias of headline; kept for back-compat with existing prompts
 *   - key_phrase — narration highlight (~7.5% of height, soft box)
 *   - quote      — alias of key_phrase; back-compat
 *   - comparison — split A/B layout (rendered as a single line "A | B")
 *   - list_item  — numbered list entry (~9%, slightly punchier box)
 *   - source     — citation badge at the bottom (~3.5%, subtle box)
 *   - cta        — call-to-action (small-medium, brand-accent box)
 *   - default    — legacy bottom-caption fallback
 */
export type OverlayEmphasis =
  | 'stat'
  | 'headline'
  | 'title'
  | 'key_phrase'
  | 'quote'
  | 'comparison'
  | 'list_item'
  | 'source'
  | 'cta'
  | 'default'

export interface OverlayOptions {
  text: string
  position?: OverlayPosition
  emphasis?: OverlayEmphasis
  /** When set, the overlay only renders during [startTimeSec, endTimeSec]
   *  of the underlying clip. Used by the PR2 word-sync engine to make
   *  overlays appear at the exact moment the trigger word is spoken,
   *  rather than for the entire scene. Both omitted ⇒ overlay shows
   *  for the full clip duration (legacy behaviour). */
  startTimeSec?: number
  endTimeSec?: number
}

/**
 * Resolves the drawtext font path on disk, trying the primary Liberation Sans
 * Bold first (installed in the Docker image) then the macOS dev fallback.
 * Returns null if neither is available — caller should skip the overlay and
 * log a warning rather than fail the render.
 */
function resolveOverlayFont(): string | null {
  if (existsSync(DRAWTEXT_FONT_PRIMARY))  return DRAWTEXT_FONT_PRIMARY
  if (existsSync(DRAWTEXT_FONT_FALLBACK)) return DRAWTEXT_FONT_FALLBACK
  return null
}

/**
 * Builds an ffmpeg `drawtext=...` filter string from overlay options. Returns
 * null if no font is available on disk or the text is empty.
 *
 * Font size and box styling are computed per `emphasis`:
 *   - stat    → very large, semi-transparent box (the number is the star)
 *   - title   → medium-large, solid box (headline treatment)
 *   - quote   → medium, soft box, wider line spacing
 *   - cta     → small-medium, brand-accent box
 *   - default → medium with black box (legacy bottom-caption look)
 */
function buildOverlayFilter(
  overlay: OverlayOptions,
  width: number,
  height: number,
): string | null {
  const fontPath = resolveOverlayFont()
  if (!fontPath) return null

  const text = overlay.text?.trim()
  if (!text) return null

  const emphasis = overlay.emphasis ?? 'default'

  // Default position by emphasis: source → bottom (citation badge),
  // cta → bottom (call-to-action), headline → top (section title),
  // everything else → center.
  const defaultPosition: OverlayPosition =
      emphasis === 'source'   ? 'bottom-center'
    : emphasis === 'cta'      ? 'bottom-center'
    : emphasis === 'headline' ? 'top-center'
    : 'center'
  const position = overlay.position ?? defaultPosition

  // Base font size as a percentage of output height.
  // Numbers below match the spec font-size targets (1080p reference):
  //   stat       ~140px → 0.13
  //   headline    ~96px → 0.09
  //   list_item   ~96px → 0.09 (numéro géant)
  //   key_phrase  ~64px → 0.06
  //   comparison  ~36px → 0.034
  //   source      ~16px → 0.018 (small citation)
  const baseRatio =
      emphasis === 'stat'       ? 0.13
    : emphasis === 'headline'   ? 0.09
    : emphasis === 'title'      ? 0.075
    : emphasis === 'list_item'  ? 0.09
    : emphasis === 'key_phrase' ? 0.06
    : emphasis === 'quote'      ? 0.055
    : emphasis === 'comparison' ? 0.034
    : emphasis === 'cta'        ? 0.055
    : emphasis === 'source'     ? 0.018
    : 0.045
  const fontSize = Math.max(20, Math.round(height * baseRatio))
  const boxBorder = Math.max(8, Math.round(fontSize * 0.35))

  // Box styling — stat / headline get a punchy dark box; source is a
  // subtle backdrop; comparison stays minimal; others use the legacy soft box.
  const boxColor =
      emphasis === 'stat'       ? 'black@0.70'
    : emphasis === 'headline'   ? 'black@0.70'
    : emphasis === 'list_item'  ? 'black@0.70'
    : emphasis === 'cta'        ? 'black@0.75'
    : emphasis === 'title'      ? 'black@0.65'
    : emphasis === 'key_phrase' ? 'black@0.55'
    : emphasis === 'comparison' ? 'black@0.55'
    : emphasis === 'source'     ? 'black@0.45'
    : 'black@0.55'

  // X position — left / center / right with an 8% safe-area margin.
  const marginX = Math.round(width * 0.06)
  const xExpr =
      position.endsWith('-left')   ? `${marginX}`
    : position.endsWith('-right')  ? `w-text_w-${marginX}`
    : '(w-text_w)/2'

  // Y position — top / center / bottom with an 8% safe-area margin.
  const marginY = Math.round(height * 0.08)
  const yExpr =
      position.startsWith('top-')    ? `${marginY}`
    : position.startsWith('bottom-') ? `h-text_h-${marginY}`
    : '(h-text_h)/2'

  const parts = [
    `drawtext=fontfile='${fontPath}'`,
    `text='${escapeDrawtext(text)}'`,
    `fontsize=${fontSize}`,
    `fontcolor=white`,
    `box=1`,
    `boxcolor=${boxColor}`,
    `boxborderw=${boxBorder}`,
    `x=${xExpr}`,
    `y=${yExpr}`,
    `line_spacing=6`,
  ]

  // Word-sync window (PR2): only render the overlay between
  // `startTimeSec` and `endTimeSec` of this clip. drawtext's `enable`
  // option takes a boolean expression evaluated per frame; `between(t,
  // X, Y)` is true when the current time `t` is in [X, Y]. When either
  // bound is missing or invalid we fall back to the legacy "always on"
  // behaviour by skipping the option entirely.
  if (
    typeof overlay.startTimeSec === 'number'
    && typeof overlay.endTimeSec === 'number'
    && overlay.endTimeSec > overlay.startTimeSec
    && overlay.startTimeSec >= 0
  ) {
    const start = overlay.startTimeSec.toFixed(2)
    const end   = overlay.endTimeSec.toFixed(2)
    parts.push(`enable='between(t,${start},${end})'`)
  }

  return parts.join(':')
}

/**
 * Génère un clip Ken Burns (zoom+pan) sur une image statique via FFmpeg zoompan.
 * 50× plus rapide que Remotion/Chromium — aucune dépendance Chrome.
 *
 * Si `overlayText` est fourni, une incrustation de texte (drawtext) est ajoutée
 * au filtre — positionnée en bas-centre avec une boîte noire semi-transparente
 * pour garantir la lisibilité quel que soit le fond.
 */
export async function renderKenBurnsFFmpeg(options: {
  imageUrl: string
  durationSeconds: number
  sceneIndex?: number
  format?: '16:9' | '9:16' | '1:1'
  /** Legacy string overlay — treated as a bottom-center caption. */
  overlayText?: string
  /** Preferred: typed overlay with position + emphasis (stat/title/quote/cta). */
  overlay?: OverlayOptions
}): Promise<Buffer> {
  const { imageUrl, durationSeconds, sceneIndex = 0, format = '16:9', overlayText, overlay } = options
  const { width, height } = FORMAT_DIMS_KB[format] ?? FORMAT_DIMS_KB['16:9']
  const durationFrames = Math.max(30, Math.round(durationSeconds * 30))
  const preset = KB_FFMPEG_PRESETS[sceneIndex % KB_FFMPEG_PRESETS.length]

  // Scale to 2× output resolution before zoompan → no pixelation during zoom
  const scaleW = width * 2
  const scaleH = height * 2

  const filterParts = [
    `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase`,
    `crop=${scaleW}:${scaleH}`,
    `zoompan=z='${preset.z}':x='${preset.x}':y='${preset.y}':d=${durationFrames}:s=${width}x${height}:fps=30`,
  ]

  // Resolve overlay: prefer the typed variant, fall back to the legacy string.
  const resolvedOverlay: OverlayOptions | null =
      overlay
    ? overlay
    : overlayText && overlayText.trim().length > 0
      ? { text: overlayText, position: 'bottom-center', emphasis: 'default' }
      : null

  if (resolvedOverlay) {
    const drawtext = buildOverlayFilter(resolvedOverlay, width, height)
    if (drawtext) {
      filterParts.push(drawtext)
    } else {
      logger.warn({ sceneIndex }, 'drawtext: no font available — overlay skipped')
    }
  }
  const zoompanFilter = filterParts.join(',')

  const tmpImgPath = join(tmpdir(), `clyro-kb-img-${randomUUID()}.jpg`)
  const tmpOutPath = join(tmpdir(), `clyro-kb-out-${randomUUID()}.mp4`)

  try {
    // Téléchargement de l'image source
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`KenBurns: failed to download image (${res.status})`)
    await writeFile(tmpImgPath, Buffer.from(await res.arrayBuffer()))

    await runFFmpeg([
      '-loop', '1',
      '-framerate', '30',
      '-i', tmpImgPath,
      '-vf', zoompanFilter,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-t', String(durationSeconds),
      '-threads', '2',
      '-an',
      tmpOutPath,
    ])

    const buf = await readFile(tmpOutPath)
    logger.info({ sceneIndex, durationSeconds, format, outputSize: buf.length }, 'KenBurns FFmpeg: clip rendered')
    return buf
  } finally {
    await unlink(tmpImgPath).catch(() => null)
    await unlink(tmpOutPath).catch(() => null)
  }
}

/**
 * Recalibre un clip vidéo existant (typiquement un 5s ou 10s de Kling) sur
 * une durée audio exacte.
 *
 *  • Si clip est *plus long* que la cible : on coupe avec `-t`.
 *  • Si clip est *plus court* : on étend par freeze-frame de la dernière
 *    image via le filtre `tpad=stop_mode=clone:stop_duration=Δ` (pas de
 *    boucle → c'est naturel : la voix finit, l'image reste).
 *
 * Ré-encode en h264/yuv420p pour rester compatible avec concatenateClips.
 * Retourne le chemin absolu du MP4 aligné (dans tmpdir).
 */
export async function adjustClipDurationFromUrl(
  clipUrl: string,
  targetDurationSeconds: number,
): Promise<string> {
  const target = Math.round(targetDurationSeconds * 100) / 100
  const workDir = join(tmpdir(), `clyro-clip-sync-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const srcPath = join(workDir, 'src.mp4')
  const outPath = join(workDir, 'out.mp4')

  // Télécharger le clip source (URL Supabase Storage publique ou file://)
  if (clipUrl.startsWith('file://')) {
    await copyFile(clipUrl.replace('file://', ''), srcPath)
  } else {
    const res = await fetch(clipUrl)
    if (!res.ok) throw new Error(`adjustClipDurationFromUrl: fetch ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(srcPath, buf)
  }

  // Mesurer la durée source via ffprobe
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    srcPath,
  ])
  const srcDuration = parseFloat(stdout.trim()) || 0

  // Le filtre tpad a besoin d'une marge pour extension ; `-t` re-coupe à la fin
  // pour que ce soit exact quoi qu'il arrive.
  const needsExtend = srcDuration < target - 0.05
  const vf = needsExtend
    ? `tpad=stop_mode=clone:stop_duration=${(target - srcDuration + 0.2).toFixed(2)},fps=30`
    : `fps=30`

  await runFFmpeg([
    '-i', srcPath,
    '-vf', vf,
    '-t', String(target),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-an',
    outPath,
  ])

  // Nettoyer le fichier source (pas le dossier — l'appelant lit outPath)
  await unlink(srcPath).catch(() => null)
  return outPath
}

/**
 * Burne un overlay texte (drawtext) sur un clip vidéo existant (typiquement un
 * clip Kling après re-sync). Retourne le chemin absolu du MP4 avec overlay
 * appliqué, prêt à être uploadé et concaténé.
 *
 * No-op silencieux (retourne le clip inchangé via copyFile) si :
 *   - overlay.text est vide,
 *   - aucune font disponible,
 *   - emphasis indique un overlay purement décoratif.
 */
export async function applyOverlayToClipUrl(
  clipUrl: string,
  overlay: OverlayOptions,
  format: '16:9' | '9:16' | '1:1' = '16:9',
): Promise<string> {
  const workDir = join(tmpdir(), `clyro-overlay-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const srcPath = join(workDir, 'src.mp4')
  const outPath = join(workDir, 'out.mp4')

  // Télécharger le clip source (URL Supabase Storage publique ou file://)
  if (clipUrl.startsWith('file://')) {
    await copyFile(clipUrl.replace(/^file:\/\//, ''), srcPath)
  } else {
    const res = await fetch(clipUrl, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`applyOverlay: failed to download clip (${res.status})`)
    await writeFile(srcPath, Buffer.from(await res.arrayBuffer()))
  }

  const { width, height } = FORMAT_DIMS_KB[format] ?? FORMAT_DIMS_KB['16:9']
  const drawtext = buildOverlayFilter(overlay, width, height)

  // Pas de font disponible ou texte vide → on retourne le clip inchangé.
  if (!drawtext) {
    logger.warn({ clipUrl: clipUrl.slice(0, 80) }, 'applyOverlay: skipped (no font or empty text)')
    await copyFile(srcPath, outPath)
    await unlink(srcPath).catch(() => null)
    return outPath
  }

  // Ré-encode h264/yuv420p pour rester compatible avec concatenateClips
  // (le concat demuxer exige les mêmes codec/pix_fmt/dimensions entre clips).
  await runFFmpeg([
    '-i', srcPath,
    '-vf', drawtext,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    outPath,
  ])

  await unlink(srcPath).catch(() => null)
  return outPath
}

/**
 * Crée un clip vidéo à partir d'une image en la loopant sur la durée donnée.
 * Les dimensions sortent en 1080p (Full HD) par défaut, adaptées au format
 * d'export demandé (16:9 → 1920×1080, 9:16 → 1080×1920, 1:1 → 1080×1080).
 */
export async function loopImageToClip(
  imageBuffer: Buffer,
  durationSeconds: number,
  outputPath: string,
  format: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<void> {
  const tempImagePath = join(tmpdir(), `clyro-img-${randomUUID()}.jpg`)
  const { width, height } = FORMAT_DIMS_KB[format] ?? FORMAT_DIMS_KB['16:9']

  try {
    await writeFile(tempImagePath, imageBuffer)

    await runFFmpeg([
      '-loop', '1',
      '-i', tempImagePath,
      '-t', String(durationSeconds),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-r', '24',
      '-threads', '1',
      outputPath,
    ])
  } finally {
    await unlink(tempImagePath).catch(() => null)
  }
}

/**
 * Probe a media file's duration in seconds via ffprobe.
 * Returns 0 on failure (so callers can short-circuit).
 *
 * Used to align audio/video durations precisely in the final mix pass —
 * without this we'd rely on -shortest which truncates whichever stream
 * is shorter (typically: the audio gets cut because xfade overlap shrinks
 * the video duration by (N-1) × transitionDuration seconds).
 */
async function probeMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(parseFloat(out.trim()) || 0)
      else resolve(0)
    })
    proc.on('error', () => resolve(0))
  })
}

/**
 * Concatène une liste de clips vidéo en une seule vidéo
 */
export async function concatenateClips(
  clipPaths: string[],
  outputPath: string
): Promise<void> {
  const listPath = join(tmpdir(), `clyro-concat-${randomUUID()}.txt`)

  try {
    const listContent = clipPaths.map((p) => `file '${p}'`).join('\n')
    await writeFile(listPath, listContent)

    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath,
    ])
  } finally {
    await unlink(listPath).catch(() => null)
  }
}

/**
 * Mixe la voix off (volume 100%) et la musique de fond avec ducking dynamique.
 *
 * Ducking intelligent via sidechaincompress :
 *   - Musique à 35% en l'absence de voix (intro / transitions / silence)
 *   - Compression 8:1 quand la voix dépasse -36 dB → musique réduite à ~4%
 *   - Attack 5ms (duck immédiat), release 500ms (remontée progressive)
 * Résultat : musique audible entre les phrases, inaudible sous la narration.
 */
export async function mixAudio(
  videoPath: string,
  voiceoverBuffer: Buffer,
  backgroundMusicPath: string | null,
  outputPath: string
): Promise<void> {
  const tempAudioPath = join(tmpdir(), `clyro-voice-${randomUUID()}.mp3`)

  try {
    await writeFile(tempAudioPath, voiceoverBuffer)

    // Probe both durations so we can extend video if audio is longer.
    // Without this, `-shortest` would cut the LAST WORDS of narration when
    // xfade transitions or rounding made the video stream shorter.
    const [voiceDur, videoDur] = await Promise.all([
      probeMediaDuration(tempAudioPath),
      probeMediaDuration(videoPath),
    ])
    const targetDur = Math.max(voiceDur, videoDur) + 0.3
    const videoOverhang = Math.max(0, targetDur - videoDur)
    const videoBaseFilter = videoOverhang > 0.05
      ? `[0:v]tpad=stop_mode=clone:stop_duration=${videoOverhang.toFixed(2)}[vbase]`
      : null
    const videoMap = videoBaseFilter ? '[vbase]' : '0:v'
    const videoCodec = videoBaseFilter ? ['libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p'] : ['copy']

    if (backgroundMusicPath) {
      // Normalize voiceover in the filter chain (single-pass loudnorm within the complex filter)
      // Smart ducking: music ducks when voice is detected, fills during silence
      const duckFilter = [
        '[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[voice1][voice2]',
        '[2:a]volume=0.35,aloop=loop=-1:size=2147483647[music_loop]',
        '[music_loop][voice1]sidechaincompress=threshold=0.015:ratio=8:attack=5:release=500[music_ducked]',
        '[voice2][music_ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]',
        ...(videoBaseFilter ? [videoBaseFilter] : []),
      ].join(';')

      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-i', backgroundMusicPath,
        '-filter_complex', duckFilter,
        '-map', videoMap,
        '-map', '[aout]',
        '-c:v', ...videoCodec,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', targetDur.toFixed(2),
        outputPath,
      ])
    } else if (videoBaseFilter) {
      // Voice only + tpad → use filter_complex to stitch tpad into the video stream
      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-filter_complex', videoBaseFilter,
        '-map', '[vbase]',
        '-map', '1:a',
        '-c:v', ...videoCodec,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', targetDur.toFixed(2),
        outputPath,
      ])
    } else {
      // Voice only, no padding needed → fast stream-copy of the video
      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', targetDur.toFixed(2),
        outputPath,
      ])
    }
  } finally {
    await unlink(tempAudioPath).catch(() => null)
  }
}

/**
 * Ajoute des sous-titres/overlays texte sur la vidéo
 */
export async function addSubtitles(
  videoPath: string,
  scenes: Array<{ texte_voix: string; duree_estimee: number }>,
  outputPath: string
): Promise<void> {
  // Générer le fichier SRT
  const srtContent = scenes
    .reduce(
      (acc, scene, index) => {
        const startTime = scenes
          .slice(0, index)
          .reduce((sum, s) => sum + s.duree_estimee, 0)
        const endTime = startTime + scene.duree_estimee

        const formatTime = (seconds: number) => {
          const h = Math.floor(seconds / 3600)
          const m = Math.floor((seconds % 3600) / 60)
          const s = Math.floor(seconds % 60)
          const ms = 0
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
        }

        return (
          acc +
          `${index + 1}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${scene.texte_voix}\n\n`
        )
      },
      ''
    )

  const srtPath = join(tmpdir(), `clyro-subs-${randomUUID()}.srt`)

  try {
    await writeFile(srtPath, srtContent)

    // Non-karaoke subtitle path (legacy scene-level). Matches the karaoke
    // force_style above for visual consistency across both rendering branches.
    const legacyForceStyle = 'FontName=Liberation Sans,FontSize=44,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Bold=1,BorderStyle=1,Outline=3,Shadow=2,Alignment=2,MarginV=80'
    await runFFmpeg([
      '-i', videoPath,
      '-vf', `subtitles=${srtPath}:force_style='${legacyForceStyle}'`,
      '-c:a', 'copy',
      outputPath,
    ])
  } finally {
    await unlink(srtPath).catch(() => null)
  }
}

// ── Style-aware xfade transition router ───────────────────────────────────
//
// xfade offers ~40 transition kinds. Picking the right one per visual style is
// the single biggest lever for a "produced" feel: a cinematic reel wants a slow
// fade-to-black, a motion-graphics reel wants a snappy slide, a whiteboard
// explainer wants a wipe, etc.
//
// Each style maps to an ORDERED list of xfade kinds. The pipeline alternates
// through the list so two adjacent transitions are rarely identical — that
// "dissolve, dissolve, dissolve…" feel is the #1 reason generated videos look
// cheap.

type XfadeKind =
  // Fades
  | 'fade' | 'fadeblack' | 'fadewhite' | 'fadegrays' | 'dissolve'
  // Wipes
  | 'wipeleft' | 'wiperight' | 'wipeup' | 'wipedown'
  | 'wipetl' | 'wipetr' | 'wipebl' | 'wipebr'
  // Slides
  | 'slideleft' | 'slideright' | 'slideup' | 'slidedown'
  // Smooth
  | 'smoothleft' | 'smoothright' | 'smoothup' | 'smoothdown'
  // Geometric
  | 'circleopen' | 'circleclose' | 'rectcrop' | 'circlecrop'
  | 'horzopen' | 'horzclose' | 'vertopen' | 'vertclose'
  // Dynamic
  | 'zoomin' | 'radial' | 'pixelize' | 'hblur'
  // Covers
  | 'coverleft' | 'coverright' | 'revealleft' | 'revealright'
  // Diagonals
  | 'diagtl' | 'diagtr' | 'diagbl' | 'diagbr'

export interface TransitionPlan {
  /** Ordered list of xfade kinds the router cycles through. */
  kinds: XfadeKind[]
  /** Duration of each transition, in seconds. */
  duration: number
}

/**
 * Per-style transition recipes — tuned by feel:
 *   • Cinematic / docu → slow fade-to-black, dissolve (weight and patience).
 *   • Whiteboard / stickman → crisp wipes (flipbook sketch feel).
 *   • Flat / infographie → clean slides (editorial look).
 *   • Pixar / 2D animation → iris/circle (cartoon feel).
 *   • Motion-graphics / dynamique → snappy slide + zoom (tech ad feel).
 *   • Luxe → slow dissolve + fadegrays (fashion feel).
 *   • Fun → zoomin + pixelize (playful).
 */
const TRANSITION_PLANS: Record<string, TransitionPlan> = {
  cinematique:      { kinds: ['fadeblack', 'dissolve',  'fadeblack',  'fade'],       duration: 0.55 },
  'stock-vo':       { kinds: ['dissolve',  'fade',      'fadeblack',  'dissolve'],   duration: 0.50 },
  whiteboard:       { kinds: ['wipeleft',  'wiperight', 'wipeup',     'wipedown'],   duration: 0.35 },
  stickman:         { kinds: ['wipeleft',  'wipetl',    'wiperight',  'wipebr'],     duration: 0.35 },
  minimaliste:      { kinds: ['slideleft', 'wiperight', 'slideright', 'wipeleft'],   duration: 0.40 },
  'flat-design':    { kinds: ['slideleft', 'slideright','slideup',    'slidedown'],  duration: 0.40 },
  infographie:      { kinds: ['slideleft', 'wipeleft',  'slideright', 'horzopen'],   duration: 0.40 },
  '3d-pixar':       { kinds: ['circleopen','circleclose','zoomin',    'dissolve'],   duration: 0.50 },
  'animation-2d':   { kinds: ['circleopen','wipeleft',  'zoomin',     'rectcrop'],   duration: 0.45 },
  'motion-graphics':{ kinds: ['slideleft', 'zoomin',    'slideright', 'radial'],     duration: 0.30 },
  corporate:        { kinds: ['fade',      'slideleft', 'dissolve',   'slideright'], duration: 0.45 },
  dynamique:        { kinds: ['slideleft', 'zoomin',    'radial',     'slideright'], duration: 0.30 },
  luxe:             { kinds: ['dissolve',  'fadegrays', 'fade',       'fadeblack'],  duration: 0.60 },
  fun:              { kinds: ['zoomin',    'pixelize',  'circleopen', 'slideup'],    duration: 0.35 },
}

const DEFAULT_PLAN: TransitionPlan = { kinds: ['dissolve', 'fade'], duration: 0.40 }

/**
 * Builds a deterministic transition plan for N joins given a style. The same
 * (style, sceneCount) pair always yields the same sequence — reproducible.
 * Adjacent transitions are guaranteed distinct when the plan has ≥2 kinds.
 */
export function pickTransitionPlan(style: string, sceneCount: number): { kinds: XfadeKind[]; duration: number } {
  const plan = TRANSITION_PLANS[style] ?? DEFAULT_PLAN
  const joins = Math.max(0, sceneCount - 1)
  const list = plan.kinds
  if (list.length === 0) return { kinds: [], duration: plan.duration }

  // Cycle through the list; if two adjacent would collide (possible when
  // list.length doesn't divide evenly), rotate forward.
  const out: XfadeKind[] = []
  for (let i = 0; i < joins; i++) {
    let kind = list[i % list.length]
    if (out.length > 0 && out[out.length - 1] === kind && list.length > 1) {
      kind = list[(i + 1) % list.length]
    }
    out.push(kind)
  }
  return { kinds: out, duration: plan.duration }
}

/**
 * Concatène des clips MP4 avec une transition xfade entre chaque clip.
 * Tous les clips doivent avoir le même codec/résolution/fps.
 * @param clipPaths - Chemins vers les clips re-encodés (même codec, fps, résolution)
 * @param outputPath - Chemin de sortie
 * @param transitionDuration - Durée de la transition en secondes (default 0.4s).
 *   Ignoré si `transitionPlan` est fourni.
 * @param transitionPlan - Plan de transitions par style (via pickTransitionPlan).
 *   Si absent, utilise `dissolve` uniforme (rétrocompatible).
 */
export async function concatenateClipsWithTransitions(
  clipPaths: string[],
  outputPath: string,
  transitionDuration = 0.4,
  transitionPlan?: { kinds: XfadeKind[]; duration: number }
): Promise<void> {
  if (clipPaths.length < 2) {
    return concatenateClips(clipPaths, outputPath)
  }

  // Au-delà de ~30 clips, la commande filter_complex xfade devient une string
  // de plusieurs KB avec 30+ filter nodes empilés → ARG_MAX atteint sur Linux,
  // parsing FFmpeg >30s, et risque de stack overflow dans avfilter. Au-delà
  // de ce seuil on retombe sur le concat demuxer (pas de transitions, mais
  // assemblage fiable). Tunable via FFMPEG_XFADE_MAX_CLIPS env var.
  const XFADE_MAX_CLIPS = Number(process.env.FFMPEG_XFADE_MAX_CLIPS ?? 30)
  if (clipPaths.length > XFADE_MAX_CLIPS) {
    logger.warn(
      { clipCount: clipPaths.length, threshold: XFADE_MAX_CLIPS },
      'Too many clips for xfade filter_complex — falling back to concat demuxer (no transitions)',
    )
    return concatenateClips(clipPaths, outputPath)
  }

  // Obtenir la durée de chaque clip via ffprobe
  async function getClipDuration(clipPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        clipPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(parseFloat(out.trim()) || 5)
        else reject(new Error(`ffprobe failed: code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  const durations = await Promise.all(clipPaths.map(getClipDuration))

  // Construire le filter_complex xfade pour N clips
  // [0:v][1:v]xfade=transition=dissolve:duration=T:offset=D0-T[v01]
  // [v01][2:v]xfade=transition=dissolve:duration=T:offset=D0+D1-2T[v012]...
  const inputs = clipPaths.flatMap((p) => ['-i', p])
  const td = transitionPlan?.duration ?? transitionDuration

  let filterParts = ''
  let currentLabel = '[0:v]'
  let cumulativeOffset = 0

  for (let i = 1; i < clipPaths.length; i++) {
    const prevDuration = durations[i - 1]
    const offset = cumulativeOffset + prevDuration - td
    const outLabel = i === clipPaths.length - 1 ? '[vout]' : `[v${i}]`
    const kind: XfadeKind = transitionPlan?.kinds[i - 1] ?? 'dissolve'
    filterParts += `${currentLabel}[${i}:v]xfade=transition=${kind}:duration=${td}:offset=${offset.toFixed(3)}${outLabel};`
    currentLabel = outLabel
    cumulativeOffset += prevDuration - td
  }

  // Retirer le dernier ";" et le label de sortie en trop
  filterParts = filterParts.slice(0, -1)

  await runFFmpeg([
    ...inputs,
    '-filter_complex', filterParts,
    '-map', '[vout]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '26',
    '-pix_fmt', 'yuv420p',
    '-r', '24',
    outputPath,
  ])
}

// ── Helpers SRT et clips Kling ─────────────────────────────────────────────

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * Génère un SRT karaoke mot par mot à partir des timestamps ElevenLabs.
 * Chaque résultat de scène est décalé par l'offset cumulatif audio.
 */
export function generateKaraokeFromWords(
  sceneResults: Array<{ words: WordTimestamp[]; audioOffset: number }>
): string {
  let index = 1
  let srt = ''

  for (const { words, audioOffset } of sceneResults) {
    for (const w of words) {
      const start = audioOffset + w.start
      const end = audioOffset + w.end
      srt += `${index}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${w.word}\n\n`
      index++
    }
  }

  return srt
}

/**
 * Télécharge un clip vidéo depuis une URL vers un fichier temporaire.
 * Timeout 90s pour éviter un hang infini sur des URLs qui ne répondent pas.
 */
async function downloadVideoUrl(url: string, outputPath: string): Promise<void> {
  // file:// URLs come from locally-rendered Ken Burns clips — just copy the file
  if (url.startsWith('file://')) {
    await copyFile(url.slice(7), outputPath)
    return
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Failed to download video clip: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFile(outputPath, buffer)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error(`Download timed out (90s): ${url.slice(0, 80)}`)
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

interface AssembleFromClipsOptions {
  sceneVideoUrls: Array<{ sceneId: string; videoUrl: string }>
  voiceoverBuffer: Buffer | null
  backgroundMusicPath?: string
  karaokeSubsContent?: string
  /** Skip re-encoding step (Ken Burns clips are already uniform h264/yuv420p).
   *  Transitions are still applied via xfade when `style` is provided. */
  skipTransitions?: boolean
  /** Video style (cinematique, whiteboard, flat-design, motion-graphics, …).
   *  Used to pick a per-style xfade recipe via pickTransitionPlan(). */
  style?: string
  /** Output aspect ratio. Drives the scale/pad filter in both re-encode and
   *  xfade paths. Defaults to 16:9. */
  format?: '16:9' | '9:16' | '1:1'
}

/**
 * Assemble la vidéo finale depuis des clips Kling (i2v) :
 * 1. Télécharge tous les clips en parallèle
 * 2. Re-encode chaque clip pour uniformiser codec/fps
 * 3. Concatène
 * 4. Mixe l'audio (voix off + musique)
 * 5. (optionnel) Ajoute les sous-titres karaoke mot par mot
 */
export async function assembleVideoFromVideoClips(options: AssembleFromClipsOptions): Promise<Buffer> {
  const { sceneVideoUrls, voiceoverBuffer, backgroundMusicPath, karaokeSubsContent, skipTransitions = false, style } = options

  const workDir = join(tmpdir(), `clyro-kling-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const tempFiles: string[] = []

  try {
    // Télécharger tous les clips Kling en parallèle
    const downloadedPaths = await Promise.all(
      sceneVideoUrls.map(async ({ sceneId, videoUrl }) => {
        const clipPath = join(workDir, `raw_${sceneId}.mp4`)
        await downloadVideoUrl(videoUrl, clipPath)
        tempFiles.push(clipPath)
        return { sceneId, clipPath }
      })
    )

    if (downloadedPaths.length === 0) throw new Error('No Kling clips to assemble')

    // Re-encode or stream-copy depending on clip source.
    // Ken Burns clips (skipTransitions=true) are already uniform 1280×720 24fps h264 yuv420p
    // produced by renderKenBurnsFFmpeg — re-encoding would be pure waste.
    // Kling/fal clips need normalisation (varying resolutions, fps, codecs).
    const concatPath = join(workDir, 'concat.mp4')
    tempFiles.push(concatPath)

    // Format-aware output dimensions: Ken Burns clips are rendered at these
    // dims upstream (renderKenBurnsFFmpeg uses FORMAT_DIMS_KB), so re-encoding
    // uses the same target — guarantees xfade filter_complex compatibility.
    const format = options.format ?? '16:9'
    const { width: outW, height: outH } = FORMAT_DIMS_KB[format] ?? FORMAT_DIMS_KB['16:9']

    if (skipTransitions) {
      // Ken Burns path: clips are already uniform at FORMAT_DIMS_KB[format]
      // (1080p), 24fps h264 yuv420p, so xfade filter_complex is cheap
      // (no re-encode pre-pass needed). If a style is provided we pick a
      // matching recipe; otherwise we fall back to the fast stream-copy
      // concat (no transitions).
      const kenBurnsPaths = downloadedPaths.map((d) => d.clipPath)
      if (kenBurnsPaths.length < 2 || !style) {
        await concatenateClips(kenBurnsPaths, concatPath)
      } else {
        const plan = pickTransitionPlan(style, kenBurnsPaths.length)
        await concatenateClipsWithTransitions(kenBurnsPaths, concatPath, plan.duration, plan)
      }
    } else {
      // Re-encode concurrency limit: each ffmpeg process peaks at ~400-600MB RSS
      // when converting a Kling 5-10s 720p clip to 1080p yuv420p (1080p is ~1.5×
      // the memory of 720p). Render Standard = 2GB RAM → 4 in parallel = OOM
      // risk. 2 keeps peak at ~1.2GB leaving room for the final encode + Node
      // heap + the mp4Buffer we hold until upload.
      const CLIP_CONCURRENCY = 2
      const reEncodedPaths: string[] = []

      for (let i = 0; i < downloadedPaths.length; i += CLIP_CONCURRENCY) {
        const batch = downloadedPaths.slice(i, i + CLIP_CONCURRENCY)
        const batchPaths = await Promise.all(
          batch.map(async ({ sceneId, clipPath }) => {
            const reEncodedPath = join(workDir, `enc_${sceneId}.mp4`)
            await runFFmpeg([
              '-i', clipPath,
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-crf', '26',
              '-pix_fmt', 'yuv420p',
              '-vf', `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`,
              '-r', '24',
              '-threads', '0',
              '-an',
              reEncodedPath,
            ])
            tempFiles.push(reEncodedPath)
            return reEncodedPath
          })
        )
        reEncodedPaths.push(...batchPaths)
      }

      if (reEncodedPaths.length === 1) {
        await concatenateClips(reEncodedPaths, concatPath)
      } else {
        const plan = style ? pickTransitionPlan(style, reEncodedPaths.length) : undefined
        await concatenateClipsWithTransitions(reEncodedPaths, concatPath, plan?.duration ?? 0.4, plan)
      }
    }

    // ── Single final pass: loudnorm + audio mix + subtitle burn in ONE FFmpeg call ──
    // Previously this was 3-4 separate encode passes (loudnorm ×2, mix, subtitle).
    // Now everything is done in a single filter_complex → saves 2-3 minutes per video.
    const finalPath = join(workDir, 'final.mp4')
    tempFiles.push(finalPath)

    if (voiceoverBuffer) {
      const voicePath = join(workDir, 'voice.mp3')
      await writeFile(voicePath, voiceoverBuffer)
      tempFiles.push(voicePath)

      const srtPath = karaokeSubsContent ? join(workDir, 'karaoke.srt') : null
      if (srtPath && karaokeSubsContent) {
        await writeFile(srtPath, karaokeSubsContent, 'utf-8')
        tempFiles.push(srtPath)
      }

      // ── Audio/video duration sync ─────────────────────────────────────
      // Probe BOTH durations to know how to align them. Without this, the
      // xfade transitions in concatenateClipsWithTransitions shrink the
      // total video by (N-1) × transitionDuration seconds, while the audio
      // is concatenated without overlap → audio ends up LONGER than video.
      // With `-shortest` (the previous behavior), the LAST WORDS of the
      // narration would get truncated. Now we:
      //   1. tpad the video by cloning the last frame to absorb the
      //      audio overhang (+ a 0.3s safety tail for natural decay)
      //   2. use explicit `-t targetDur` instead of `-shortest` so the
      //      output length is exactly the longer of (audio, video).
      const [voiceDur, videoDur] = await Promise.all([
        probeMediaDuration(voicePath),
        probeMediaDuration(concatPath),
      ])
      const targetDur = Math.max(voiceDur, videoDur) + 0.3
      const videoOverhang = Math.max(0, targetDur - videoDur)
      logger.info(
        { voiceDur: voiceDur.toFixed(2), videoDur: videoDur.toFixed(2), videoOverhang: videoOverhang.toFixed(2) },
        'FFmpeg: audio/video duration sync — extending video to cover the full voiceover'
      )

      // Build filter_complex: loudnorm (single-pass inline) + ducking + optional subtitles
      // Single-pass loudnorm is slightly less accurate than 2-pass but 2× faster.
      const loudnormFilter = 'loudnorm=I=-16:TP=-1.5:LRA=11'
      // Karaoke subtitle styling (OpusClip-grade lisibilité):
      //   • FontSize=48 — 4× larger than the 720p default, scaled for 1080p
      //     vertical viewing. Readable on phone screens held at arm's length.
      //   • Bold=1 + BorderStyle=1 (outline + shadow, no box background) →
      //     pops against any scene, doesn't cover the imagery.
      //   • Outline=3.5 + Shadow=2 → ensures contrast on any background
      //     (bright sky, busy B-roll, motion-graphics) without a black box.
      //   • MarginV=80 → lifts subs 80px above the bottom edge so they don't
      //     collide with TikTok/Reels/Shorts UI chrome.
      //   • Alignment=2 → bottom-center (ASS convention).
      const forceStyle = [
        'FontName=Liberation Sans',
        'FontSize=48',
        'PrimaryColour=&H00FFFFFF',
        'OutlineColour=&H00000000',
        'BackColour=&H80000000',
        'Bold=1',
        'BorderStyle=1',
        'Outline=3.5',
        'Shadow=2',
        'Alignment=2',
        'MarginV=80',
      ].join('\\,')

      const inputs: string[] = ['-i', concatPath, '-i', voicePath]
      if (backgroundMusicPath) inputs.push('-i', backgroundMusicPath)

      const musicIdx = backgroundMusicPath ? 2 : -1
      let filterComplex: string
      let videoMap: string
      let audioMap: string

      // Video chain: tpad to extend video duration when needed, then optional
      // subtitle burn-in. The downstream subtitle filter consumes [vbase]
      // (post-tpad) instead of [0:v] so subtitles render across the full
      // padded video, including the cloned-frame tail.
      const videoBaseFilter = videoOverhang > 0.05
        ? `[0:v]tpad=stop_mode=clone:stop_duration=${videoOverhang.toFixed(2)}[vbase]`
        : null
      const videoInputLabel = videoBaseFilter ? '[vbase]' : '[0:v]'
      const subtitleFilter = srtPath
        ? `${videoInputLabel}subtitles=${srtPath}:force_style=${forceStyle}[vout]`
        : null

      const videoChainParts: string[] = []
      if (videoBaseFilter) videoChainParts.push(videoBaseFilter)
      if (subtitleFilter) videoChainParts.push(subtitleFilter)

      if (backgroundMusicPath) {
        // [normv] split into [normv1] (sidechain) + [normv2] (amix input)
        // to avoid "pad already connected" error — each named pad can only be consumed once
        filterComplex = [
          `[1:a]${loudnormFilter},asplit=2[normv1][normv2]`,
          `[${musicIdx}:a]volume=0.35,aloop=loop=-1:size=2147483647[mloop]`,
          '[mloop][normv1]sidechaincompress=threshold=0.015:ratio=8:attack=5:release=500[mduck]',
          '[normv2][mduck]amix=inputs=2:duration=first:dropout_transition=0[aout]',
          ...videoChainParts,
        ].join(';')
        videoMap = srtPath ? '[vout]' : (videoBaseFilter ? '[vbase]' : '0:v')
        audioMap = '[aout]'
      } else {
        filterComplex = [
          `[1:a]${loudnormFilter}[aout]`,
          ...videoChainParts,
        ].join(';')
        videoMap = srtPath ? '[vout]' : (videoBaseFilter ? '[vbase]' : '0:v')
        audioMap = '[aout]'
      }

      try {
        // Final pass encode — runs ONCE per video. ultrafast/crf26 was chosen
        // for speed when this was 3 separate passes; now it's a single pass so
        // we can afford a tighter encode. veryfast+crf28 is ~40-50% smaller
        // at 720p with quasi-identical perceived quality, keeping us well
        // below the Supabase bucket per-file cap (default 50 MiB on Free).
        //
        // `-t targetDur` replaces the old `-shortest`. -shortest cut the
        // output to the shorter of (audio, video) — but xfade made video
        // shorter than audio, so it truncated the LAST WORDS of narration.
        // With explicit -t we control output length precisely, and the
        // tpad above ensures video reaches that length too.
        await runFFmpeg([
          ...inputs,
          '-filter_complex', filterComplex,
          '-map', videoMap,
          '-map', audioMap,
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '28',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-t', targetDur.toFixed(2),
          finalPath,
        ])
        logger.info({ subs: !!srtPath, music: !!backgroundMusicPath, targetDur: targetDur.toFixed(2) }, 'FFmpeg: final pass done (single encode)')
      } catch (finalErr) {
        // Fallback: skip subtitles if the subtitle filter failed (font not found etc.)
        // Re-encode video here too (instead of `-c copy`) because we need the
        // tpad filter applied to fix the audio-cut issue.
        logger.warn({ finalErr }, 'FFmpeg: final pass with subtitles failed — retrying without subtitles')
        const fallbackVideoChain = videoBaseFilter ? [videoBaseFilter] : []
        const fallbackVideoMap = videoBaseFilter ? '[vbase]' : '0:v'
        const filterSimple = backgroundMusicPath
          ? [
              `[1:a]${loudnormFilter},asplit=2[normv1][normv2]`,
              `[${musicIdx}:a]volume=0.35,aloop=loop=-1:size=2147483647[mloop]`,
              '[mloop][normv1]sidechaincompress=threshold=0.015:ratio=8:attack=5:release=500[mduck]',
              '[normv2][mduck]amix=inputs=2:duration=first:dropout_transition=0[aout]',
              ...fallbackVideoChain,
            ].join(';')
          : [
              `[1:a]${loudnormFilter}[aout]`,
              ...fallbackVideoChain,
            ].join(';')
        await runFFmpeg([
          ...inputs,
          '-filter_complex', filterSimple,
          '-map', fallbackVideoMap,
          '-map', '[aout]',
          '-c:v', videoBaseFilter ? 'libx264' : 'copy',
          ...(videoBaseFilter ? ['-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p'] : []),
          '-c:a', 'aac',
          '-b:a', '128k',
          '-t', targetDur.toFixed(2),
          finalPath,
        ])
      }
    } else {
      // No voiceover — just copy the concat
      await runFFmpeg(['-i', concatPath, '-c', 'copy', finalPath])
    }

    const finalBuffer = await readFile(finalPath)
    logger.info({ clipCount: sceneVideoUrls.length, outputSize: finalBuffer.length }, 'FFmpeg: Kling clips assembled')
    return finalBuffer
  } finally {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
    await rm(workDir, { recursive: true, force: true }).catch(() => null)
  }
}

interface AssembleVideoOptions {
  scenes: Array<{
    id: string
    description_visuelle: string
    texte_voix: string
    duree_estimee: number
    /**
     * Durée réelle de la voix off ElevenLabs pour cette scène (en secondes).
     * Si présente, c'est elle qui détermine la durée du clip image — sinon on
     * retombe sur `duree_estimee` (estimation word-count, imprécise).
     */
    audioDuration?: number
    image_url?: string
  }>
  sceneImages: Array<{ sceneId: string; imageUrl: string }>
  voiceoverBuffer: Buffer | null
  backgroundMusicPath?: string
  addSubtitlesFlag?: boolean
  /** Output aspect ratio — drives clip dimensions in loopImageToClip.
   *  Defaults to 16:9. */
  format?: '16:9' | '9:16' | '1:1'
}

/**
 * Orchestre l'assemblage complet d'une vidéo :
 * 1. Loop chaque image sur la durée de scène → clip
 * 2. Concatène les clips
 * 3. Mixe l'audio (voix off + musique)
 * 4. (optionnel) Ajoute les sous-titres
 * Retourne le Buffer MP4 final
 */
export async function assembleVideo(options: AssembleVideoOptions): Promise<Buffer> {
  const { scenes, sceneImages, voiceoverBuffer, backgroundMusicPath, addSubtitlesFlag, format = '16:9' } = options

  const workDir = join(tmpdir(), `clyro-assemble-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const clipPaths: string[] = []
  const tempFiles: string[] = []

  try {
    // Étape 1 : Téléchargement des images en parallèle, puis création des clips en parallèle
    // (vs. séquentiel précédent: download1 → clip1 → download2 → clip2 → …)
    const scenesToProcess = scenes.filter((s) => sceneImages.some((img) => img.sceneId === s.id))

    // Télécharger toutes les images simultanément
    const downloadedImages = await Promise.all(
      scenesToProcess.map(async (scene) => {
        const sceneImage = sceneImages.find((img) => img.sceneId === scene.id)!
        const imageResponse = await fetch(sceneImage.imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to download scene image ${scene.id}: ${imageResponse.status}`)
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        return { scene, imageBuffer }
      })
    )

    // Créer tous les clips en parallèle (max 4 simultanés pour ne pas saturer le CPU)
    const CLIP_CONCURRENCY = 4
    const orderedClipPaths: string[] = []

    for (let i = 0; i < downloadedImages.length; i += CLIP_CONCURRENCY) {
      const batch = downloadedImages.slice(i, i + CLIP_CONCURRENCY)
      const batchPaths = await Promise.all(
        batch.map(async ({ scene, imageBuffer }) => {
          const clipPath = join(workDir, `clip_${scene.id}.mp4`)
          // Durée de l'image = durée *réelle* de la voix off si disponible
          // (évite le drift images-voix). Fallback sur l'estimation word-count.
          const exact = scene.audioDuration
          const durationSec = exact && exact > 0.5 ? exact : scene.duree_estimee
          await loopImageToClip(imageBuffer, durationSec, clipPath, format)
          tempFiles.push(clipPath)
          return clipPath
        })
      )
      orderedClipPaths.push(...batchPaths)
    }

    clipPaths.push(...orderedClipPaths)

    if (clipPaths.length === 0) {
      throw new Error('No clips generated — check scene images')
    }

    // Étape 2 : Concaténer les clips
    const concatPath = join(workDir, 'concat.mp4')
    tempFiles.push(concatPath)
    await concatenateClips(clipPaths, concatPath)

    // Étape 3 : Mixer l'audio
    let currentPath = concatPath

    if (voiceoverBuffer) {
      const mixedPath = join(workDir, 'mixed.mp4')
      tempFiles.push(mixedPath)
      await mixAudio(currentPath, voiceoverBuffer, backgroundMusicPath ?? null, mixedPath)
      currentPath = mixedPath
    }

    // Étape 4 : Sous-titres (optionnel)
    if (addSubtitlesFlag) {
      const subtitledPath = join(workDir, 'subtitled.mp4')
      tempFiles.push(subtitledPath)
      await addSubtitles(currentPath, scenes, subtitledPath)
      currentPath = subtitledPath
    }

    // Lire le fichier final
    const finalBuffer = await readFile(currentPath)

    logger.info(
      { sceneCount: scenes.length, outputSize: finalBuffer.length },
      'FFmpeg: video assembled'
    )

    return finalBuffer
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => null)
  }
}

// ============================================================================
// F5-011 — Studio final render
// ============================================================================
// Downloads every scene's already-rendered MP4 (HeyGen/Remotion/Pexels),
// normalises each one to a uniform codec/container, and concatenates them
// into a single MP4 suitable for upload + playback. Each scene already has
// its own baked-in audio (HeyGen voiceover + music layer), so this helper
// only touches the video/audio streams enough to make the concat demuxer
// happy.
// ============================================================================

export interface StudioSceneClip {
  sceneId:  string
  videoUrl: string
}

export async function assembleStudioVideo(
  sceneClips: StudioSceneClip[],
  format: '16_9' | '9_16' = '16_9',
): Promise<Buffer> {
  if (sceneClips.length === 0) {
    throw new Error('assembleStudioVideo: no scene clips provided')
  }

  const workDir = join(tmpdir(), `clyro-studio-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  // Canvas size + scale/pad filter tuned to each format.
  const [targetW, targetH] = format === '9_16' ? [1080, 1920] : [1920, 1080]
  const scalePad =
    `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
    `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`

  try {
    // 1) Parallel download of all scene videos.
    const downloaded = await Promise.all(
      sceneClips.map(async ({ sceneId, videoUrl }) => {
        const raw = join(workDir, `raw_${sceneId}.mp4`)
        await downloadVideoUrl(videoUrl, raw)
        return { sceneId, raw }
      }),
    )

    // 2) Re-encode each clip to a uniform h264/aac profile. Using ultrafast
    //    + crf 23 gives decent quality without blocking the node process too
    //    long. Audio is kept (128k aac) since HeyGen bakes the voiceover in.
    const CONCURRENCY = 4
    const normalised: string[] = []
    for (let i = 0; i < downloaded.length; i += CONCURRENCY) {
      const batch = downloaded.slice(i, i + CONCURRENCY)
      const batchOut = await Promise.all(
        batch.map(async ({ sceneId, raw }) => {
          const out = join(workDir, `norm_${sceneId}.mp4`)
          await runFFmpeg([
            '-i', raw,
            '-vf', scalePad,
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '48000',
            '-ac', '2',
            '-shortest',
            '-movflags', '+faststart',
            out,
          ])
          return out
        }),
      )
      normalised.push(...batchOut)
    }

    // 3) Concat demuxer (stream-copy since all clips share the same params).
    const finalPath = join(workDir, 'final.mp4')
    if (normalised.length === 1) {
      // Single-scene edge case: just rename.
      await copyFile(normalised[0]!, finalPath)
    } else {
      await concatenateClips(normalised, finalPath)
    }

    const buf = await readFile(finalPath)
    logger.info(
      { sceneCount: sceneClips.length, outputBytes: buf.length, format },
      'FFmpeg: studio video assembled',
    )
    return buf
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => null)
  }
}
