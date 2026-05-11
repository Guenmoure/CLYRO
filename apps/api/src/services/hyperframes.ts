/**
 * CLYRO — HyperFrames Service
 *
 * Wraps HeyGen avatar MP4 clips inside a HyperFrames composition for the
 * Avatar Studio (F5) pipeline. Adds branded lower-third + scene caption +
 * cinematic vignette around the talking head, instead of just concatenating
 * raw HeyGen output.
 *
 * Why HyperFrames here vs Remotion :
 *   - HTML+CSS+GSAP authoring is simpler than React for "video chrome"
 *     (lower-thirds, cards, captions) and the templates can be edited
 *     without a build step.
 *   - GSAP timelines render frame-accurately under HyperFrames (seek-driven),
 *     unlike Remotion which plays at wall-clock during render.
 *   - Apache 2.0 license — no per-render fees as we scale Avatar Studio.
 *
 * Activation : feature flag `ENRICH_AVATAR_WITH_HYPERFRAMES=true` on the
 * worker env. Default off — falls back to the existing concat-only path
 * so we can ship the integration without affecting in-flight jobs.
 *
 * Setup notes :
 *   - Dockerfile pre-warms the HF binary via `npx --yes hyperframes@latest doctor`
 *   - Node 22+ required (bumped in apps/api/Dockerfile)
 *   - Bundled Chrome ships with the npm package — no separate Chromium install
 */

import { spawn } from 'child_process'
import { writeFile, readFile, mkdir, rm, copyFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'

// ── Templates ──────────────────────────────────────────────────────────────
// Loaded once at module init. Each template has placeholders interpolated by
// `interpolateTemplate()` at compose time.
const TEMPLATE_DIR = join(__dirname, '..', 'templates', 'hyperframes')
export type TemplateName =
  | 'avatar-lower-third'
  | 'avatar-intro-card'
  | 'avatar-pip'
  | 'avatar-tiktok'
  | 'avatar-instagram'

/** All available templates — used by the frontend for the picker UI. */
export const HYPERFRAMES_TEMPLATES: readonly TemplateName[] = [
  'avatar-lower-third',
  'avatar-intro-card',
  'avatar-pip',
  'avatar-tiktok',
  'avatar-instagram',
] as const
let templateCache: Partial<Record<TemplateName, string>> = {}

async function loadTemplate(name: TemplateName): Promise<string> {
  if (templateCache[name]) return templateCache[name]!
  const path = join(TEMPLATE_DIR, `${name}.html`)
  const html = await readFile(path, 'utf-8')
  templateCache[name] = html
  return html
}

// ── Format helpers ─────────────────────────────────────────────────────────
const FORMAT_DIMS: Record<'16_9' | '9_16' | '1_1', { width: number; height: number }> = {
  '16_9': { width: 1920, height: 1080 },
  '9_16': { width: 1080, height: 1920 },
  '1_1':  { width: 1080, height: 1080 },
}

/** Convert hex color to a slightly darker variant for gradient effects. */
function darkenHex(hex: string, factor = 0.7): string {
  const m = hex.match(/^#([0-9A-Fa-f]{6})$/)
  if (!m) return hex
  const v = parseInt(m[1], 16)
  const r = Math.max(0, Math.min(255, Math.round(((v >> 16) & 0xff) * factor)))
  const g = Math.max(0, Math.min(255, Math.round(((v >> 8) & 0xff) * factor)))
  const b = Math.max(0, Math.min(255, Math.round((v & 0xff) * factor)))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Build a proper `rgba()` string from a #RRGGBB hex and a 0-100 alpha %.
 * Used to interpolate `__BRAND_RGBA_<NN>__` placeholders in templates with a
 * real alpha channel — the old `__BRAND_COLOR__40` trick produced 8-digit
 * hex like `#RRGGBB40` which CSS interprets as ~25 % alpha (0x40 / 0xFF),
 * not the intended 40 %.
 */
function hexToRgba(hex: string, alphaPercent: number): string {
  const m = hex.match(/^#([0-9A-Fa-f]{6})$/)
  if (!m) return hex
  const v = parseInt(m[1], 16)
  const r = (v >> 16) & 0xff
  const g = (v >> 8)  & 0xff
  const b =  v        & 0xff
  const a = Math.max(0, Math.min(1, alphaPercent / 100))
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface ComposeAvatarSceneParams {
  /** HTTPS or file:// URL of the HeyGen avatar MP4 for this scene. */
  avatarVideoUrl:    string
  /** Total scene duration in seconds (drives composition timeline length). */
  durationSeconds:   number
  /** Output aspect ratio. */
  format:            '16_9' | '9_16' | '1_1'
  /** Brand primary color in #RRGGBB hex. Drives lower-third bar + ribbon dot. */
  brandColor:        string
  /** Big text in the lower-third (e.g. avatar's name or speaker tag). */
  lowerThirdTitle:   string
  /** Small text below title (e.g. role / tagline). */
  lowerThirdSub?:    string
  /** Optional caption shown as a top ribbon (e.g. scene number / topic). */
  captionText?:      string
  /** Where to write the rendered MP4. */
  outputPath:        string
  /** Template variant. Default 'avatar-lower-third'. */
  template?:         TemplateName
  /** Frame rate. Default 30. */
  fps?:              number
  /** HyperFrames `--workers` flag. Default 1 — caller-level parallelism is
   *  preferred since each scene is short and worker startup costs 1-2 s. */
  workers?:          number
}

/**
 * Spawns `npx hyperframes render` and waits for the MP4 to be written.
 * Captures stderr for diagnostics on failure (HyperFrames prints structured
 * progress to stderr, similar to FFmpeg).
 */
async function runHyperframesRender(args: {
  projectDir:  string
  outputPath:  string
  fps:         number
  workers?:    number
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      [
        '--yes', 'hyperframes@latest', 'render',
        '--output', args.outputPath,
        '--fps',    String(args.fps),
        '--quality', 'standard',
        '--workers', String(args.workers ?? 2),
        '--quiet',
      ],
      {
        cwd:   args.projectDir,
        env:   { ...process.env, NPM_CONFIG_YES: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stderr = ''
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.stdout?.on('data', (chunk: Buffer) => {
      // HyperFrames prints "Captured N frames" / "Encoded to X" to stdout.
      // Forward as info logs — useful for diagnosing slow renders in prod.
      const line = chunk.toString().trim()
      if (line.length > 0) logger.debug({ hyperframes: line }, 'HF render progress')
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`hyperframes render exited ${code}: ${stderr.slice(0, 800)}`))
      }
    })
    proc.on('error', (err) => {
      reject(new Error(`hyperframes spawn failed: ${err.message}`))
    })
  })
}

/**
 * Composes a single Avatar Studio scene by wrapping the HeyGen MP4 in a
 * HyperFrames template. Writes the result to `outputPath`.
 *
 * Failure is non-fatal at the caller level — see runStudioPipeline's branch
 * which falls back to the raw avatar MP4 when this throws.
 */
export async function composeAvatarSceneWithHyperframes(
  params: ComposeAvatarSceneParams,
): Promise<void> {
  const {
    avatarVideoUrl,
    durationSeconds,
    format,
    brandColor,
    lowerThirdTitle,
    lowerThirdSub = '',
    captionText = '',
    outputPath,
    template = 'avatar-lower-third',
    fps = 30,
    workers = 1,
  } = params

  // Each compose runs in an isolated tmp dir so concurrent scenes don't
  // collide on filenames / GSAP globals.
  const projectDir = join(tmpdir(), `clyro-hf-${randomUUID()}`)
  await mkdir(projectDir, { recursive: true })

  try {
    // Download the avatar MP4 into the project dir as `assets/avatar.mp4`.
    // HyperFrames can read both http(s) and file:// in <video src>, but
    // shipping the MP4 inside the project dir keeps the composition self-
    // contained (good for caching, easier debug if the render fails).
    const assetDir = join(projectDir, 'assets')
    await mkdir(assetDir, { recursive: true })
    const localAvatar = join(assetDir, 'avatar.mp4')

    if (avatarVideoUrl.startsWith('file://')) {
      await copyFile(avatarVideoUrl.replace('file://', ''), localAvatar)
    } else {
      const res = await fetch(avatarVideoUrl, {
        signal: AbortSignal.timeout(120_000),
      })
      if (!res.ok) throw new Error(`Avatar fetch ${res.status}: ${avatarVideoUrl.slice(0, 120)}`)
      await writeFile(localAvatar, Buffer.from(await res.arrayBuffer()))
    }

    // Load + interpolate the template.
    const { width, height } = FORMAT_DIMS[format]
    const html = await loadTemplate(template)
    // First-letter initial for Instagram-style avatars. Falls back to 'C'
    // if the title is empty or starts with whitespace/punctuation.
    const firstChar = lowerThirdTitle.trim().charAt(0).toUpperCase()
    const initial = /[A-ZÀ-ſ]/.test(firstChar) ? firstChar : 'C'

    // Pre-compute the rgba alpha variants the templates reference. Adding new
    // values here is OK — they just become extra no-op replacements if the
    // template doesn't use them.
    const rgbaAlphas = [8, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90] as const
    let interpolated = html
      .replace(/__AVATAR_SRC__/g,         'assets/avatar.mp4')
      .replace(/__DURATION__/g,           durationSeconds.toFixed(2))
      .replace(/__WIDTH__/g,              String(width))
      .replace(/__HEIGHT__/g,             String(height))
      .replace(/__BRAND_COLOR_DARK__/g,   darkenHex(brandColor, 0.6))
      // CRITICAL: replace __BRAND_COLOR__ *after* __BRAND_COLOR_DARK__ so the
      // longer key wins. If we did `__BRAND_COLOR__` first it would munch the
      // prefix of `__BRAND_COLOR_DARK__` and leave a stray `_DARK__`.
      .replace(/__BRAND_COLOR__/g,        brandColor)
      .replace(/__LOWER_THIRD_TITLE__/g,  escapeHtml(lowerThirdTitle))
      .replace(/__LOWER_THIRD_SUB__/g,    escapeHtml(lowerThirdSub))
      .replace(/__CAPTION_TEXT__/g,       escapeHtml(captionText))
      .replace(/__INITIAL__/g,            escapeHtml(initial))
    for (const pct of rgbaAlphas) {
      const re = new RegExp(`__BRAND_RGBA_${String(pct).padStart(2, '0')}__`, 'g')
      interpolated = interpolated.replace(re, hexToRgba(brandColor, pct))
    }

    const indexPath = join(projectDir, 'index.html')
    await writeFile(indexPath, interpolated, 'utf-8')

    // Minimal meta.json (HyperFrames CLI reads this to identify the project).
    const meta = {
      name:       `clyro-avatar-${randomUUID().slice(0, 8)}`,
      id:         `clyro-${randomUUID()}`,
      created_at: new Date().toISOString(),
    }
    await writeFile(join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

    const startedAt = Date.now()
    await runHyperframesRender({ projectDir, outputPath, fps, workers })

    logger.info(
      {
        template, format, durationSeconds, fps,
        durationMs: Date.now() - startedAt,
        avatarBytes: (await readFile(localAvatar).catch(() => Buffer.alloc(0))).length,
      },
      'HyperFrames: avatar scene composed',
    )
  } finally {
    // Always clean up the project dir — keeps /tmp from filling up after
    // a long-running worker has assembled hundreds of videos.
    await rm(projectDir, { recursive: true, force: true }).catch(() => null)
  }
}

/**
 * Returns true when the feature flag is enabled. Called from the studio
 * pipeline before deciding whether to compose each scene through HF.
 */
export function isHyperframesEnabled(): boolean {
  return process.env.ENRICH_AVATAR_WITH_HYPERFRAMES === 'true'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
}
