// ── CLYRO — URL → plain-text extractor ────────────────────────────────────────
// Safe, dependency-free HTML scraper for the blog-to-video pipeline.
// Defends against SSRF (localhost / private IPs), oversized downloads, and
// non-HTML content types. Used by POST /generate/script-from-url.

import { logger } from '../lib/logger'

export interface ExtractedArticle {
  url: string
  finalUrl: string
  title: string
  description: string
  content: string
  wordCount: number
  language?: string
}

export class UrlExtractError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const USER_AGENT = 'ClyroBot/1.0 (+https://clyro.app/bot)'

// ── SSRF guards ────────────────────────────────────────────────────────────────

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',  // GCP metadata service
  '169.254.169.254',            // AWS / GCP / Azure metadata IP
])

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false
  }
  const [a, b] = parts
  return (
    a === 10 ||                             // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
    (a === 192 && b === 168) ||             // 192.168.0.0/16
    a === 127 ||                            // loopback
    a === 0 ||                              // 0.0.0.0/8
    (a === 169 && b === 254) ||             // link-local
    a >= 224                                // multicast + reserved
  )
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:')) return true           // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // unique-local fc00::/7
  return false
}

export function validatePublicUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new UrlExtractError('INVALID_URL', 'URL malformée.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlExtractError('INVALID_PROTOCOL', 'Seul http(s) est accepté.')
  }
  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host)) {
    throw new UrlExtractError('BLOCKED_HOST', 'Ce domaine est bloqué.')
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIPv4(host)) {
    throw new UrlExtractError('PRIVATE_IP', 'IP privée interdite.')
  }
  if (host.includes(':') && isPrivateIPv6(host)) {
    throw new UrlExtractError('PRIVATE_IP', 'IP privée interdite.')
  }
  return url
}

// ── Fetch with limits ──────────────────────────────────────────────────────────

async function fetchWithLimits(url: URL, redirectsLeft = MAX_REDIRECTS): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr,en;q=0.8',
      },
      redirect: 'manual',
      signal: controller.signal,
    })

    // Manual redirect to re-validate each hop (defeat DNS-rebinding via redirect)
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new UrlExtractError('BAD_REDIRECT', 'Redirection sans Location.')
      if (redirectsLeft <= 0) throw new UrlExtractError('TOO_MANY_REDIRECTS', 'Trop de redirections.')
      const next = validatePublicUrl(new URL(loc, url).toString())
      return fetchWithLimits(next, redirectsLeft - 1)
    }

    if (!res.ok) {
      throw new UrlExtractError('UPSTREAM_ERROR', `Le site a répondu ${res.status}.`, 502)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      throw new UrlExtractError('UNSUPPORTED_CONTENT_TYPE', `Type non supporté : ${contentType || 'inconnu'}.`)
    }

    const contentLength = Number(res.headers.get('content-length') ?? 0)
    if (contentLength && contentLength > MAX_BYTES) {
      throw new UrlExtractError('PAYLOAD_TOO_LARGE', 'Page trop lourde (> 5 Mo).', 413)
    }

    // Stream with byte cap
    if (!res.body) throw new UrlExtractError('EMPTY_BODY', 'Corps vide.')
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        try { await reader.cancel() } catch { /* noop */ }
        throw new UrlExtractError('PAYLOAD_TOO_LARGE', 'Page trop lourde (> 5 Mo).', 413)
      }
      chunks.push(value)
    }
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c, off); off += c.byteLength }

    // Charset sniff — most modern sites are utf-8; we fall back gracefully.
    const charsetMatch = /charset=([^;]+)/i.exec(contentType)
    const charset = charsetMatch?.[1]?.trim().toLowerCase() || 'utf-8'
    let html: string
    try {
      html = new TextDecoder(charset).decode(buf)
    } catch {
      html = new TextDecoder('utf-8').decode(buf)
    }
    return { html, finalUrl: url.toString() }
  } finally {
    clearTimeout(timer)
  }
}

// ── HTML → structured content ──────────────────────────────────────────────────

function stripTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
  return html.replace(re, ' ')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const code = parseInt(entity.slice(2), 16)
        return Number.isFinite(code) ? String.fromCodePoint(code) : m
      }
      if (entity.startsWith('#')) {
        const code = parseInt(entity.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : m
      }
      const map: Record<string, string> = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
        agrave: 'à', acirc: 'â', ccedil: 'ç',
        ocirc: 'ô', ouml: 'ö',
        ucirc: 'û', uuml: 'ü',
        icirc: 'î', iuml: 'ï',
        laquo: '«', raquo: '»',
      }
      return map[entity.toLowerCase()] ?? m
    })
}

function extractTitle(html: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
  if (og?.[1]) return decodeEntities(og[1]).trim()
  const tw = /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
  if (tw?.[1]) return decodeEntities(tw[1]).trim()
  const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return t?.[1] ? decodeEntities(t[1]).replace(/\s+/g, ' ').trim() : ''
}

function extractDescription(html: string): string {
  const og = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html)
  if (og?.[1]) return decodeEntities(og[1]).trim()
  const meta = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)
  return meta?.[1] ? decodeEntities(meta[1]).trim() : ''
}

function extractLang(html: string): string | undefined {
  const m = /<html\b[^>]*\blang=["']([a-z-]+)["']/i.exec(html)
  return m?.[1]?.toLowerCase().split('-')[0]
}

/** Extract the main textual content from an HTML document.
 *  Prefers <article>, then <main>, then <body>, stripping nav/aside/script/etc. */
function extractMainText(html: string): string {
  // Drop non-content tags first
  let h = html
  for (const t of ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'form', 'nav', 'aside', 'header', 'footer']) {
    h = stripTag(h, t)
  }

  // Prefer an <article>
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(h)
  let candidate = article?.[1]
  if (!candidate) {
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(h)
    candidate = main?.[1]
  }
  if (!candidate) {
    const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(h)
    candidate = body?.[1] ?? h
  }

  // Keep paragraph-ish breaks as newlines
  const withBreaks = candidate
    .replace(/<(p|h[1-6]|li|br|div|section)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div|section)>/gi, '\n')

  // Strip remaining tags
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

// ── Public entrypoint ──────────────────────────────────────────────────────────

export async function extractArticleFromUrl(input: string): Promise<ExtractedArticle> {
  const url = validatePublicUrl(input)
  const start = Date.now()
  const { html, finalUrl } = await fetchWithLimits(url)

  // Second-pass SSRF: resolved URL could differ — re-validate
  try {
    validatePublicUrl(finalUrl)
  } catch (e) {
    throw new UrlExtractError('BLOCKED_FINAL_URL', 'URL finale bloquée.')
  }

  const title = extractTitle(html)
  const description = extractDescription(html)
  const content = extractMainText(html)
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const language = extractLang(html)

  if (wordCount < 50) {
    throw new UrlExtractError(
      'INSUFFICIENT_CONTENT',
      `Contenu insuffisant (${wordCount} mots extraits). Essaye une page d'article dédiée.`,
    )
  }

  logger.info(
    { url: input, finalUrl, title, wordCount, language, ms: Date.now() - start },
    'URL extracted',
  )

  return { url: input, finalUrl, title, description, content, wordCount, language }
}
