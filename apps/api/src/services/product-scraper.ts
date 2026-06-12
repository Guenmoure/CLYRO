/**
 * Product page scraper — Phase 2 du portage Pomelli (« Add from URL »).
 *
 * Lit une URL e-commerce et essaie d'en extraire `{ name, image_url,
 * description }` pour pré-remplir une fiche produit du Catalog.
 *
 * Stratégie volontairement simple (pas de cheerio / jsdom — éviter une
 * dépendance lourde) :
 *   1. JSON-LD Product schema  (le plus fiable — Shopify, WooCommerce,
 *      Squarespace, BigCommerce les exposent tous correctement)
 *   2. Open Graph meta tags    (fallback universel)
 *   3. <title> + première grande image (dernier recours)
 *
 * Limites :
 *   • Pas de JS rendering — les sites tout-client side rendering (SPA
 *     pure sans SSR) renverront du HTML vide. Mais ces sites sont
 *     minoritaires en e-commerce.
 *   • Timeout 10 s, max 2 MB de HTML — protège l'API contre les pages
 *     géantes qui sature la mémoire du worker.
 */

import { logger } from '../lib/logger'

export interface ScrapedProduct {
  name:        string
  image_url:   string
  description?: string
  source_url:  string
}

const FETCH_TIMEOUT_MS = 10_000
const MAX_HTML_BYTES   = 2 * 1024 * 1024 // 2 MB
const USER_AGENT = 'CLYRO-ProductScraper/1.0 (+https://clyro.app)'

export class ScrapeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
  }
}

/**
 * Récupère une URL produit et tente d'en extraire les infos clés.
 * Lève ScrapeError avec un code typé en cas d'échec.
 */
export async function scrapeProductPage(rawUrl: string): Promise<ScrapedProduct> {
  // Validation stricte de l'URL — refuse les schémas non http/https
  // pour éviter qu'un client poste `file://` ou `javascript:` et déclenche
  // un comportement étrange sur fetch.
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ScrapeError('Invalid URL', 'INVALID_URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScrapeError('Only http(s) URLs are supported', 'INVALID_SCHEME')
  }

  // Defense-in-depth contre SSRF : refuse les adresses privées / loopback.
  // Le `hostname` peut être un nom DNS qui résout sur du privé — ce check
  // ne suffit pas seul mais empêche déjà les attaques évidentes.
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new ScrapeError('Private host blocked', 'BLOCKED_HOST')
  }

  let html: string
  try {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      })
      if (!res.ok) {
        throw new ScrapeError(`HTTP ${res.status}`, 'HTTP_ERROR')
      }
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new ScrapeError(`Unexpected content-type: ${contentType}`, 'BAD_CONTENT_TYPE')
      }
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_HTML_BYTES) {
        throw new ScrapeError('Page too large', 'PAGE_TOO_LARGE')
      }
      html = new TextDecoder('utf-8').decode(buf)
    } finally {
      clearTimeout(timeoutHandle)
    }
  } catch (err) {
    if (err instanceof ScrapeError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new ScrapeError('Fetch timeout', 'TIMEOUT')
    }
    throw new ScrapeError((err as Error).message || 'Fetch failed', 'FETCH_FAILED')
  }

  // ── Strategy 1 : JSON-LD Product ─────────────────────────────────────────
  const fromJsonLd = extractFromJsonLd(html)
  if (fromJsonLd?.name && fromJsonLd.image_url) {
    logger.info({ url: rawUrl, strategy: 'json-ld' }, 'Product scraped via JSON-LD')
    return {
      name:        fromJsonLd.name,
      image_url:   fromJsonLd.image_url,
      description: fromJsonLd.description,
      source_url:  rawUrl,
    }
  }

  // ── Strategy 2 : Open Graph ──────────────────────────────────────────────
  const fromOg = extractFromOpenGraph(html)
  if (fromOg?.name && fromOg.image_url) {
    logger.info({ url: rawUrl, strategy: 'open-graph' }, 'Product scraped via Open Graph')
    return {
      name:        fromOg.name,
      image_url:   fromOg.image_url,
      description: fromOg.description,
      source_url:  rawUrl,
    }
  }

  // ── Strategy 3 : <title> + first <img> ───────────────────────────────────
  const fromFallback = extractFromFallback(html, url)
  if (fromFallback?.name && fromFallback.image_url) {
    logger.info({ url: rawUrl, strategy: 'fallback' }, 'Product scraped via fallback')
    return {
      name:        fromFallback.name,
      image_url:   fromFallback.image_url,
      description: fromFallback.description,
      source_url:  rawUrl,
    }
  }

  throw new ScrapeError('Could not extract product info', 'EXTRACTION_FAILED')
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface PartialProduct {
  name?:        string
  image_url?:   string
  description?: string
}

/**
 * Extrait le premier bloc JSON-LD de type Product. Tolérant : @graph,
 * tableaux, valeurs imbriquées d'image (string | object | array).
 */
function extractFromJsonLd(html: string): PartialProduct | null {
  // Match all `<script type="application/ld+json">…</script>` blocks
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html)) !== null) {
    const raw = match[1].trim()
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      continue
    }
    const product = findProductNode(json)
    if (product) {
      return {
        name:        typeof product.name === 'string' ? product.name.trim() : undefined,
        image_url:   normalizeImage(product.image),
        description: typeof product.description === 'string' ? product.description.trim() : undefined,
      }
    }
  }
  return null
}

// Type minimal pour les nœuds JSON-LD qu'on parcourt
interface JsonLdProduct {
  '@type'?: string | string[]
  '@graph'?: unknown
  name?: unknown
  image?: unknown
  description?: unknown
}

function findProductNode(node: unknown): JsonLdProduct | null {
  if (!node || typeof node !== 'object') return null
  const n = node as JsonLdProduct

  // Directly @type === 'Product' (ou ['Product', '…'])
  const type = n['@type']
  if (Array.isArray(type) ? type.includes('Product') : type === 'Product') {
    return n
  }

  // Parcours @graph (Schema.org)
  if (n['@graph'] && Array.isArray(n['@graph'])) {
    for (const item of n['@graph']) {
      const found = findProductNode(item)
      if (found) return found
    }
  }

  // Tableau au top-level
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item)
      if (found) return found
    }
  }

  return null
}

function normalizeImage(image: unknown): string | undefined {
  if (typeof image === 'string') return image
  if (Array.isArray(image) && image.length > 0) return normalizeImage(image[0])
  if (image && typeof image === 'object') {
    const obj = image as { url?: unknown; '@id'?: unknown; contentUrl?: unknown }
    if (typeof obj.url === 'string') return obj.url
    if (typeof obj['@id'] === 'string') return obj['@id']
    if (typeof obj.contentUrl === 'string') return obj.contentUrl
  }
  return undefined
}

function extractFromOpenGraph(html: string): PartialProduct | null {
  const get = (prop: string): string | undefined => {
    // <meta property="og:..." content="...">  ou  <meta content="..." property="og:...">
    const re1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i')
    return (html.match(re1)?.[1] ?? html.match(re2)?.[1])?.trim()
  }
  const name        = get('og:title')
  const image_url   = get('og:image') ?? get('og:image:url')
  const description = get('og:description')
  if (!name && !image_url) return null
  return { name, image_url, description }
}

function extractFromFallback(html: string, baseUrl: URL): PartialProduct | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const name = titleMatch?.[1]?.replace(/\s+/g, ' ').trim()
  // Cherche la première grande image — heuristique sur src d'un <img>
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i)
  let image_url: string | undefined
  if (imgMatch?.[1]) {
    try {
      // Resolve relative URLs against the base
      image_url = new URL(imgMatch[1], baseUrl.toString()).toString()
    } catch {
      image_url = undefined
    }
  }
  if (!name || !image_url) return null
  return { name, image_url }
}
