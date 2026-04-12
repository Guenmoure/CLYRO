// ── Brand Identity types ────────────────────────────────────────────────────

export type BrandAmbiance = 'luxe' | 'accessible' | 'tech' | 'naturel' | 'fun' | 'corporate'

export interface BrandBrief {
  name: string
  secteur: string
  cible: string
  valeurs: string[]           // 3 brand value keywords
  ambiance: BrandAmbiance
  concurrents?: string        // brands to NOT look like
  logo_url?: string           // existing logo URL (optional)
  couleurs_imposees?: string  // imposed HEX colors (comma-separated)
  references?: string         // reference brands (inspiration)
}

export interface BrandPalette {
  primary: string     // HEX
  secondary: string   // HEX
  accent: string      // HEX
  neutral: string     // HEX
  background: string  // HEX
  description: string
}

export interface BrandTypography {
  heading: string   // e.g. "Playfair Display"
  body: string      // e.g. "Inter"
  description: string
}

export interface BrandDirection {
  id: 'direction_1' | 'direction_2' | 'direction_3' | 'direction_hybrid'
  name: string        // creative direction name
  tagline: string     // short brand tagline
  positioning: string // brand positioning statement
  palette: BrandPalette
  typography: BrandTypography
  mood: string        // mood board description
  keywords: string[]  // 4–5 visual keywords
}

export interface BrandVoice {
  tone: string
  examples: string[]  // example phrases
  dos: string[]
  donts: string[]
}

export interface BrandStrategy {
  directions: [BrandDirection, BrandDirection, BrandDirection]
  voice: BrandVoice
}

// ── Analyst result ──────────────────────────────────────────────────────────

export interface ContradictionPath {
  label: string         // "Path A: Luxury Minimalist" | "Path B: Fun Minimalist"
  description: string   // Clear explanation of this interpretation (1-2 phrases)
  resolution: string    // Creative directive (e.g., "luxury, refined, golden" or "vibrant, playful, bold")
}

export interface BrandAnalysisResult {
  is_ready: boolean
  brief_score: number           // 0-100
  contradictions: string[]
  questions: string[]
  suggestions: string[]
  brief_quality?: 'sufficient' | 'insufficient'
  clarification_questions?: string[]  // Questions if brief quality is insufficient
  has_contradiction?: boolean           // True if contradictions detected, requiring path selection
  contradiction_paths?: ContradictionPath[]  // 2 alternative creative paths to resolve contradictions
}

// ── Logo concepts (recraft-v3 × 3 backgrounds) ─────────────────────────────

export interface BrandLogoConcept {
  name: string            // "Monogramme" | "Wordmark" | "Emblème"
  logo_white_bg?: string  // URL on white background
  logo_brand_bg?: string  // URL on primary color background
  logo_black_bg?: string  // URL on black background
}

export interface BrandLogos {
  concepts: BrandLogoConcept[]
}

// ── Extended assets (8-12 items) ────────────────────────────────────────────

export interface BrandAssets {
  logo_url?: string
  logo_dark_url?: string
  mockup_business_card?: string
  mockup_social_post?: string
  mockup_email_header?: string
  mockup_letterhead?: string
  mockup_packaging?: string
  lifestyle_mockup?: string
  pattern_url?: string
  illustration_url?: string
  brand_banner?: string
  og_image_url?: string
}

// Keep BrandVisuals as alias for backwards compat
export type BrandVisuals = BrandAssets

// ── Charter ─────────────────────────────────────────────────────────────────

export interface BrandCharteColor {
  name: string
  hex: string
  rgb: string
  usage: string
}

export interface BrandCharte {
  logo_rules: {
    clear_space: string
    allowed_backgrounds: string[]
    forbidden: string[]
  }
  colors: BrandCharteColor[]
  typography: {
    heading: { font: string; weight: string; sizes: string; usage: string }
    body: { font: string; weight: string; sizes: string; usage: string }
    caption: { font: string; weight: string; sizes: string; usage: string }
  }
  layout: { grid: string; spacing: string; margins: string }
  photography: { style: string; mood: string; forbidden: string[] }
}

export type BrandStudioStep = 'brief' | 'strategy' | 'logos' | 'assets' | 'charte' | 'export'
