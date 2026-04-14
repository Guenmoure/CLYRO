/**
 * Content templates for Faceless videos.
 *
 * Each template represents a YouTube channel style (e.g. "EasyWay Actually",
 * "Aura Vasta") and provides:
 * - A pre-baked claude system prompt to drive the storyboard generation
 * - A recommended fal style + scene count
 * - A script example to inspire the user
 *
 * Loaded from /lib/faceless-templates.json (raw data from the SQL migration
 * supabase/migrations/20260414000001_video_templates.sql).
 */

import templatesJson from './faceless-templates.json'

export type ContentTemplateLanguage = 'en' | 'fr' | 'es' | 'de' | 'pt'

export type ContentTemplateStyle =
  | 'animation-2d'
  | 'stock-vo'
  | 'minimaliste'
  | 'infographie'
  | 'whiteboard'
  | 'cinematique'

export interface ContentTemplate {
  id: string
  name: string
  channel_url: string
  niche: string
  language: ContentTemplateLanguage
  is_public: boolean
  fal_style: ContentTemplateStyle
  recommended_scene_count: number
  tone_keywords: string[]
  tags: string[]
  claude_system_prompt: string
  structure_guide: Record<string, string>
  script_example: string
}

// Cast through unknown — JSON is validated by Zod or trusted DB schema upstream
export const CONTENT_TEMPLATES = templatesJson as unknown as ContentTemplate[]

// ── UI helpers ────────────────────────────────────────────────────────────────

export interface NicheGroup {
  id: string
  label: string
  emoji: string
}

const NICHE_LABELS: Record<string, NicheGroup> = {
  lifestyle:                { id: 'lifestyle',                label: 'Lifestyle',          emoji: '🌿' },
  psychology:               { id: 'psychology',               label: 'Psychologie',        emoji: '🧠' },
  psychology_contrarian:    { id: 'psychology_contrarian',    label: 'Psycho contrarian',  emoji: '🔁' },
  psychology_reframing:     { id: 'psychology_reframing',     label: 'Psycho reframing',   emoji: '💡' },
  spirituality_wellness:    { id: 'spirituality_wellness',    label: 'Spiritualité',       emoji: '✨' },
  self_improvement:         { id: 'self_improvement',         label: 'Self-improvement',   emoji: '🚀' },
  mental_health:            { id: 'mental_health',            label: 'Santé mentale',      emoji: '🌱' },
  personal_development:     { id: 'personal_development',     label: 'Développement perso',emoji: '📈' },
  productivity:             { id: 'productivity',             label: 'Productivité',       emoji: '⚡' },
  productivity_mindfulness: { id: 'productivity_mindfulness', label: 'Productivité douce', emoji: '🧘' },
  knowledge_education:      { id: 'knowledge_education',      label: 'Éducation',          emoji: '📚' },
  personal_finance:         { id: 'personal_finance',         label: 'Finances perso',     emoji: '💰' },
  investing:                { id: 'investing',                label: 'Investissement',     emoji: '📊' },
  wealth_building:          { id: 'wealth_building',          label: 'Wealth building',    emoji: '🏦' },
  wealth_luxury_mindset:    { id: 'wealth_luxury_mindset',    label: 'Luxe & mindset',     emoji: '💎' },
}

export function getNicheLabel(niche: string): NicheGroup {
  return NICHE_LABELS[niche] ?? { id: niche, label: niche, emoji: '🎬' }
}

// Style → CSS gradient (mirrors STYLE_TEMPLATES but generic)
export function getStyleGradient(style: ContentTemplateStyle): string {
  switch (style) {
    case 'cinematique':  return 'from-amber-500/30 via-orange-500/20 to-red-500/20'
    case 'animation-2d': return 'from-pink-500/30 via-purple-500/20 to-indigo-500/20'
    case 'minimaliste':  return 'from-stone-200/60 via-stone-100/40 to-emerald-100/30'
    case 'infographie':  return 'from-blue-500/30 via-cyan-500/20 to-sky-400/20'
    case 'stock-vo':     return 'from-slate-400/30 via-slate-300/20 to-zinc-400/20'
    case 'whiteboard':   return 'from-gray-200/60 via-white/40 to-blue-100/40'
  }
}

// Visual style → descriptor used in the auto-generated description
const STYLE_VISUAL_DESCRIPTORS: Record<ContentTemplateStyle, string> = {
  'cinematique':
    'cinématique, lumière dorée ou bleue, plans contemplatifs, textures organiques (nature, eau, ciel), silhouettes poétiques',
  'animation-2d':
    'animation 2D cartoon, personnages stylisés avec expressions expressives, palette colorée non agressive, bulles de pensée',
  'minimaliste':
    'minimaliste, fonds épurés, palette douce (beige, blanc cassé, vert sauge), formes géométriques simples, espace négatif dominant',
  'infographie':
    'infographie moderne, graphiques et schémas animés, icônes plates, palette bleue/cyan, data visuelle claire',
  'stock-vo':
    'plans stock réalistes (nature, ville, gens), voix-off narrative, transitions douces, style documentaire accessible',
  'whiteboard':
    'whiteboard animé, tracé à la main qui se dessine, palette noir/blanc/bleu, style pédagogique épuré',
}

/**
 * Build a user-facing description from a template.
 * This is what gets pre-filled in the "Description du contenu" textarea
 * when the user picks a template.
 *
 * Focuses on: ambience, visuals/animation, main message — NO script.
 * The actual script belongs in the Script field below.
 */
export function buildTemplateDescription(t: ContentTemplate): string {
  const niche = getNicheLabel(t.niche).label.toLowerCase()
  const tone = t.tone_keywords.slice(0, 4).join(', ')
  const visuals = STYLE_VISUAL_DESCRIPTORS[t.fal_style]
  // Main message arc: first and last scene of the structure guide
  const structureValues = Object.values(t.structure_guide)
  const arcStart = structureValues[0]?.replace(/\s*\(\d+s?\)\s*$/, '') ?? ''
  const arcEnd   = structureValues[structureValues.length - 1]?.replace(/\s*\(\d+s?\)\s*$/, '') ?? ''

  return `Vidéo ${niche} inspirée du style "${t.name}".

Ambiance : ${tone}.

Visuel : ${visuals}. ${t.recommended_scene_count} scènes rythmées.

Message principal : partir de "${arcStart.toLowerCase()}" pour amener le spectateur vers "${arcEnd.toLowerCase()}".`
}
