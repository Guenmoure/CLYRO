/**
 * Brand Book renderer — Phase 5 du portage Pomelli.
 *
 * Prend un Brand Kit complet, charge le template HTML par défaut, et
 * interpole les valeurs (nom, tagline, palette, valeurs, esthétique,
 * tone, business overview) pour produire un snapshot HTML autonome
 * stockable en base et affichable dans un iframe sandbox.
 *
 * V1 : pas de génération de PDF server-side. Le viewer front utilise
 * window.print() pour produire le PDF côté navigateur. C'est suffisant
 * pour 99 % des usages.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../lib/logger'

const TEMPLATE_PATH = path.resolve(__dirname, '../templates/brand-book/default.html')

let cachedTemplate: string | null = null

async function loadTemplate(): Promise<string> {
  if (cachedTemplate) return cachedTemplate
  cachedTemplate = await fs.readFile(TEMPLATE_PATH, 'utf-8')
  return cachedTemplate
}

/** Échappe le HTML pour empêcher l'injection de script via les champs marque. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface BrandBookData {
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

/**
 * Interpole une chaîne de template avec un Record de valeurs. Supporte deux
 * syntaxes :
 *   - {{key}}                  remplace par la valeur (HTML-échappée si string)
 *   - {{#key}}...{{/key}}      conditionnel : le bloc apparaît si la valeur
 *                              est truthy (non null, non false, non '')
 *
 * Volontairement minimaliste — pas de boucle, pas de moteur Mustache complet.
 */
function interpolate(template: string, data: Record<string, unknown>): string {
  // 1. Conditional blocks
  let html = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) => {
    const value = data[key]
    if (value === undefined || value === null || value === false || value === '') return ''
    if (Array.isArray(value) && value.length === 0) return ''
    return body
  })
  // 2. Simple substitutions
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key]
    if (value === undefined || value === null || value === false) return ''
    return String(value)
  })
  return html
}

function tagListHtml(tags: string[] | null | undefined, muted = false): string {
  if (!tags || tags.length === 0) return ''
  return tags
    .map((t) => `<span class="tag${muted ? ' muted' : ''}">${escapeHtml(t)}</span>`)
    .join('')
}

function logoVariant(logoUrl: string | null | undefined, brandName: string): { light: string; dark: string; brand: string; secondary: string } {
  if (logoUrl) {
    const escaped = escapeHtml(logoUrl)
    const img = `<img src="${escaped}" alt="${escapeHtml(brandName)} logo">`
    return { light: img, dark: img, brand: img, secondary: img }
  }
  // Fallback : monogram en lettre capitale, stylé.
  const initial = escapeHtml((brandName.trim().charAt(0) || '·').toUpperCase())
  const span = (cls: string) => `<span class="placeholder">${initial}</span>`
  return { light: span('placeholder'), dark: span('placeholder'), brand: span('placeholder'), secondary: span('placeholder') }
}

/**
 * Rend le brand book HTML complet pour un Brand Kit. La sortie est
 * autonome (CSS inline) et peut être stockée directement dans la colonne
 * `html_snapshot` de brand_books puis servie via iframe.
 */
export async function renderBrandBookHtml(brand: BrandBookData): Promise<string> {
  const template = await loadTemplate()

  const logoVariants = logoVariant(brand.logo_url, brand.name)

  // CSS font-family. On laisse la police principale au début, puis une stack
  // de fallback robuste, et Instrument Serif pour les titres (déjà géré
  // dans le CSS du template).
  const fontFamilyCss = brand.font_family
    ? `${escapeHtml(brand.font_family)}, Geist, system-ui, -apple-system, sans-serif`
    : `Geist, system-ui, -apple-system, sans-serif`

  const data: Record<string, unknown> = {
    name:                escapeHtml(brand.name),
    url:                 brand.url ? escapeHtml(brand.url) : '',
    tagline:             brand.tagline ? escapeHtml(brand.tagline) : '',
    primary_color:       brand.primary_color,
    secondary_color:     brand.secondary_color ?? '',
    font_family_css:     fontFamilyCss,
    logo_html_light:     logoVariants.light,
    logo_html_dark:      logoVariants.dark,
    logo_html_brand:     logoVariants.brand,
    logo_html_secondary: logoVariants.secondary,
    has_values:          (brand.brand_values?.length ?? 0) > 0,
    brand_values_html:   tagListHtml(brand.brand_values),
    has_aesthetic:       (brand.brand_aesthetic?.length ?? 0) > 0,
    brand_aesthetic_html: tagListHtml(brand.brand_aesthetic, true),
    has_tone:            (brand.brand_tone_of_voice?.length ?? 0) > 0,
    brand_tone_html:     tagListHtml(brand.brand_tone_of_voice),
    has_overview:        !!brand.business_overview,
    business_overview:   brand.business_overview ? escapeHtml(brand.business_overview) : '',
    version:             brand.version,
  }

  try {
    return interpolate(template, data)
  } catch (err) {
    logger.error({ err }, 'Brand book render failed')
    throw err
  }
}
