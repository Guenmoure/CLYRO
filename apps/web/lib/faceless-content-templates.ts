/**
 * Content templates for Faceless videos.
 *
 * Redesigned — 2026 Faceless YouTube Trends
 * -----------------------------------------
 * Each template is a generic, niche-based format (no channel names), fully
 * bilingual (EN + FR), with an optimized Claude system prompt that includes
 * structure guide and anti-patterns.
 *
 * The 8 "surfaced" visual styles map to existing `FacelessStyle` pipeline IDs
 * so the full pipeline contract (storyboard → visuals → audio → assembly)
 * stays unchanged.
 *
 * Display ID (spec)   → Pipeline ID (`FacelessStyle`)
 * ─────────────────────────────────────────────────────
 * cinematic-ai        → cinematique
 * documentary         → stock-vo
 * dark-narrative      → whiteboard          (whiteboard is dead in 2026)
 * webcomic            → stickman            (repurposed)
 * minimalist          → flat-design
 * 3d-render           → 3d-pixar
 * motion-design       → motion-graphics
 * illustrated         → animation-2d
 *
 * Loaded from /lib/faceless-templates.json.
 */

import templatesJson from './faceless-templates.json'

export type ContentLang = 'en' | 'fr'

export type ContentTemplateStyle =
  | 'animation-2d'
  | 'stock-vo'
  | 'minimaliste'
  | 'infographie'
  | 'whiteboard'
  | 'cinematique'
  | 'flat-design'
  | 'motion-graphics'
  | 'stickman'
  | '3d-pixar'

/**
 * Bilingual content template — every textual field exists in both EN and FR.
 * Legacy `language` and unilingual fields were removed; the UI picks the view
 * language from the selected tab.
 */
export interface ContentTemplate {
  id: string
  name_en: string
  name_fr: string
  niche: string
  niche_emoji: string
  niche_en: string
  niche_fr: string
  is_public: boolean
  languages: ContentLang[]
  fal_style: ContentTemplateStyle
  recommended_scene_count: number
  tone_keywords_en: string[]
  tone_keywords_fr: string[]
  tags_en: string[]
  tags_fr: string[]
  description_en: string
  description_fr: string
  script_example_en: string
  script_example_fr: string
  /** Optimized Claude prompt with anti-patterns (kept in English — Claude understands both). */
  claude_system_prompt: string
  structure_guide: Record<string, string>
}

// Cast through unknown — shape is validated by Zod or trusted DB schema upstream.
export const CONTENT_TEMPLATES = templatesJson as unknown as ContentTemplate[]

// ── Language picker ──────────────────────────────────────────────────────────

/** Pick the right side of a bilingual field based on the selected language. */
export function pickLang<T>(t: ContentTemplate, lang: ContentLang, fieldBase: string): T {
  const key = `${fieldBase}_${lang}` as keyof ContentTemplate
  return t[key] as unknown as T
}

export function tName(t: ContentTemplate, lang: ContentLang): string {
  return lang === 'fr' ? t.name_fr : t.name_en
}
export function tNiche(t: ContentTemplate, lang: ContentLang): string {
  return lang === 'fr' ? t.niche_fr : t.niche_en
}
export function tDescription(t: ContentTemplate, lang: ContentLang): string {
  return lang === 'fr' ? t.description_fr : t.description_en
}
export function tScript(t: ContentTemplate, lang: ContentLang): string {
  return lang === 'fr' ? t.script_example_fr : t.script_example_en
}
export function tTone(t: ContentTemplate, lang: ContentLang): string[] {
  return lang === 'fr' ? t.tone_keywords_fr : t.tone_keywords_en
}
export function tTags(t: ContentTemplate, lang: ContentLang): string[] {
  return lang === 'fr' ? t.tags_fr : t.tags_en
}

// ── Niche metadata (bilingual) ───────────────────────────────────────────────

export interface NicheGroup {
  id: string
  label_en: string
  label_fr: string
  emoji: string
}

const NICHE_LABELS: Record<string, NicheGroup> = {
  lifestyle:                { id: 'lifestyle',                label_en: 'Lifestyle',            label_fr: 'Lifestyle',            emoji: '🌿' },
  psychology:               { id: 'psychology',               label_en: 'Psychology',           label_fr: 'Psychologie',          emoji: '🧠' },
  psychology_contrarian:    { id: 'psychology_contrarian',    label_en: 'Contrarian psych',     label_fr: 'Psycho contrarian',    emoji: '🧩' },
  psychology_reframing:     { id: 'psychology_reframing',     label_en: 'Reframing',            label_fr: 'Psycho reframing',     emoji: '💡' },
  spirituality_wellness:    { id: 'spirituality_wellness',    label_en: 'Spirituality',         label_fr: 'Spiritualité',         emoji: '✨' },
  self_improvement:         { id: 'self_improvement',         label_en: 'Self-improvement',     label_fr: 'Développement perso',  emoji: '🔥' },
  mental_health:            { id: 'mental_health',            label_en: 'Mental health',        label_fr: 'Santé mentale',        emoji: '💛' },
  personal_development:     { id: 'personal_development',     label_en: 'Personal dev',         label_fr: 'Développement perso',  emoji: '📈' },
  productivity:             { id: 'productivity',             label_en: 'Productivity',         label_fr: 'Productivité',         emoji: '⚡' },
  productivity_mindfulness: { id: 'productivity_mindfulness', label_en: 'Productivity (calm)',  label_fr: 'Productivité douce',   emoji: '🌊' },
  knowledge_education:      { id: 'knowledge_education',      label_en: 'Education',            label_fr: 'Éducation',            emoji: '📚' },
  personal_finance:         { id: 'personal_finance',         label_en: 'Finance',              label_fr: 'Finances perso',       emoji: '💰' },
  investing:                { id: 'investing',                label_en: 'Investing',            label_fr: 'Investissement',       emoji: '📊' },
  wealth_building:          { id: 'wealth_building',          label_en: 'Wealth building',      label_fr: 'Construction richesse',emoji: '🏗️' },
  wealth_luxury_mindset:    { id: 'wealth_luxury_mindset',    label_en: 'Luxury & mindset',     label_fr: 'Luxe & mindset',       emoji: '💎' },
}

export function getNicheLabel(niche: string, lang: ContentLang = 'fr'): { id: string; label: string; emoji: string } {
  const group = NICHE_LABELS[niche]
  if (!group) return { id: niche, label: niche, emoji: '🎬' }
  return { id: group.id, label: lang === 'fr' ? group.label_fr : group.label_en, emoji: group.emoji }
}

// ── Visual style metadata (bilingual) ────────────────────────────────────────

/**
 * Bilingual style metadata surfaced to the UI.
 * Keyed by the *pipeline* ID (`FacelessStyle`) to keep backend contracts
 * intact. `display_id` is the 2026-trend label from the spec.
 */
export interface FacelessStyleMeta {
  pipeline_id: ContentTemplateStyle
  display_id: string
  label_en: string
  label_fr: string
  description_en: string
  description_fr: string
  prompt_style: string
  badge_color: string
  /** Tailwind gradient classes for cards. */
  gradient: string
  best_for_en: string[]
  best_for_fr: string[]
  fal_model: string | null
}

export const FACELESS_STYLES_META: Record<ContentTemplateStyle, FacelessStyleMeta> = {
  // 1. Cinematic AI — premium flux-pro look
  'cinematique': {
    pipeline_id: 'cinematique',
    display_id: 'cinematic-ai',
    label_en: 'Cinematic AI',
    label_fr: 'Cinématique IA',
    description_en: 'AI-generated photorealistic scenes with dramatic lighting, epic compositions, and cinematic color grading. The premium look for serious content.',
    description_fr: 'Scènes photoréalistes générées par IA avec éclairage dramatique, compositions épiques et étalonnage cinématique. Le look premium pour le contenu sérieux.',
    prompt_style: 'cinematic lighting, 8k, photorealistic, dramatic shadows, film grain, shallow depth of field, award-winning photography',
    badge_color: '#1a1a2e',
    gradient: 'from-slate-900/80 via-amber-600/20 to-slate-800/60',
    best_for_en: ['luxury & mindset', 'motivation', 'history', 'science', 'spirituality'],
    best_for_fr: ['luxe & mindset', 'motivation', 'histoire', 'science', 'spiritualité'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // 2. Documentary — stock footage + VO
  'stock-vo': {
    pipeline_id: 'stock-vo',
    display_id: 'documentary',
    label_en: 'Documentary',
    label_fr: 'Documentaire',
    description_en: 'Stock footage with professional voiceover. The classic format for business stories, true crime recaps, and investigative deep-dives.',
    description_fr: "Images d'archives avec voix off professionnelle. Le format classique pour les histoires business, true crime et investigations.",
    prompt_style: 'professional documentary footage, news broadcast quality, archival',
    badge_color: '#2d3748',
    gradient: 'from-slate-700/50 via-slate-500/20 to-sky-900/30',
    best_for_en: ['business', 'true crime', 'history', 'geopolitics', 'biography'],
    best_for_fr: ['business', 'true crime', 'histoire', 'géopolitique', 'biographie'],
    fal_model: null,
  },

  // 3. Dark Narrative — replaces whiteboard
  'whiteboard': {
    pipeline_id: 'whiteboard',
    display_id: 'dark-narrative',
    label_en: 'Dark Narrative',
    label_fr: 'Récit Sombre',
    description_en: 'Moody, atmospheric visuals with deep shadows and eerie tones. Built for horror stories, unsolved mysteries, conspiracy theories, and true crime.',
    description_fr: "Visuels atmosphériques et sombres avec ombres profondes et tons inquiétants. Conçu pour les histoires d'horreur, mystères, théories et true crime.",
    prompt_style: 'dark moody atmosphere, deep shadows, desaturated, eerie lighting, noir aesthetic, fog, dramatic tension, horror cinematic',
    badge_color: '#1a0a0a',
    gradient: 'from-black/80 via-red-900/30 to-zinc-900/60',
    best_for_en: ['horror', 'mystery', 'true crime', 'conspiracy', 'dark psychology'],
    best_for_fr: ['horreur', 'mystère', 'true crime', 'conspiration', 'psychologie sombre'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // 4. Webcomic — replaces stickman
  'stickman': {
    pipeline_id: 'stickman',
    display_id: 'webcomic',
    label_en: 'Webcomic',
    label_fr: 'Bande Dessinée',
    description_en: 'Comic strip panels with manga-influenced characters. Perfect for storytelling, Reddit stories, relationship drama, and social commentary.',
    description_fr: "Planches de BD avec personnages d'inspiration manga. Parfait pour le storytelling, les histoires Reddit et les drames relationnels.",
    prompt_style: 'comic book panel, manga style, clean line art, speech bubbles, dramatic expressions, webtoon aesthetic, digital illustration',
    badge_color: '#ff6b9d',
    gradient: 'from-pink-400/40 via-rose-300/20 to-purple-400/30',
    best_for_en: ['storytelling', 'reddit stories', 'relationship drama', 'social commentary', 'satire'],
    best_for_fr: ['storytelling', 'histoires Reddit', 'drames relationnels', 'commentaire social', 'satire'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // 5. Minimalist — replaces flat-design slot
  'flat-design': {
    pipeline_id: 'flat-design',
    display_id: 'minimalist',
    label_en: 'Minimalist',
    label_fr: 'Minimaliste',
    description_en: "Clean backgrounds, bold typography, and subtle animations. The 'less is more' aesthetic that lets words and ideas breathe.",
    description_fr: "Fonds épurés, typographie bold et animations subtiles. L'esthétique 'less is more' qui laisse respirer les mots et les idées.",
    prompt_style: 'minimal clean background, soft gradient, pastel tones, negative space, zen aesthetic, simple elegant composition',
    badge_color: '#e2e8f0',
    gradient: 'from-stone-200/70 via-stone-100/40 to-emerald-100/30',
    best_for_en: ['productivity', 'self-improvement', 'mindset', 'philosophy', 'slow living'],
    best_for_fr: ['productivité', 'développement perso', 'mindset', 'philosophie', 'slow living'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // 6. 3D Render — replaces 3d-pixar (trademark-safe)
  '3d-pixar': {
    pipeline_id: '3d-pixar',
    display_id: '3d-render',
    label_en: '3D Render',
    label_fr: 'Rendu 3D',
    description_en: '3D-rendered characters and scenes with toy-like charm. Eye-catching for education, kids content, and creative explainers.',
    description_fr: "Personnages et scènes en rendu 3D avec un charme ludique. Accrocheur pour l'éducation, le contenu jeune et les explainers créatifs.",
    prompt_style: '3D rendered scene, toy-like characters, soft ambient occlusion, colorful, cute, isometric perspective',
    badge_color: '#805ad5',
    gradient: 'from-violet-500/40 via-amber-300/25 to-orange-400/30',
    best_for_en: ['education', 'kids', 'explainers', 'fun facts', 'science'],
    best_for_fr: ['éducation', 'enfants', 'explainers', 'faits surprenants', 'science'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // 7. Motion Design — kept
  'motion-graphics': {
    pipeline_id: 'motion-graphics',
    display_id: 'motion-design',
    label_en: 'Motion Design',
    label_fr: 'Motion Design',
    description_en: 'Animated shapes, kinetic typography, and data visualizations. The professional choice for business, tech, and finance content.',
    description_fr: 'Formes animées, typographie cinétique et visualisations de données. Le choix professionnel pour le contenu business, tech et finance.',
    prompt_style: 'motion graphics, geometric shapes, data visualization, corporate clean, tech aesthetic',
    badge_color: '#6c5ce7',
    gradient: 'from-indigo-600/40 via-violet-500/25 to-fuchsia-500/25',
    best_for_en: ['finance', 'tech', 'business', 'data', 'AI tools', 'startups'],
    best_for_fr: ['finance', 'tech', 'business', 'data', 'outils IA', 'startups'],
    fal_model: null,
  },

  // 8. Illustrated — warm hand-drawn
  'animation-2d': {
    pipeline_id: 'animation-2d',
    display_id: 'illustrated',
    label_en: 'Illustrated',
    label_fr: 'Illustré',
    description_en: 'Warm hand-drawn style illustrations with character animations. Accessible and friendly for psychology, health, and education topics.',
    description_fr: 'Illustrations chaleureuses au style dessiné à la main avec animations de personnages. Accessible et amical pour la psychologie, la santé et l’éducation.',
    prompt_style: "hand-drawn illustration, warm watercolor texture, friendly characters, soft colors, editorial illustration, children's book aesthetic, cozy",
    badge_color: '#ed8936',
    gradient: 'from-orange-400/35 via-amber-300/25 to-rose-300/25',
    best_for_en: ['psychology', 'mental health', 'education', 'self-help', 'relationships'],
    best_for_fr: ['psychologie', 'santé mentale', 'éducation', 'auto-assistance', 'relations'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },

  // Legacy slots — not surfaced in the 2026 UI, kept for backwards compat with
  // older templates/DB rows. Fall back to neutral styling if referenced.
  'minimaliste': {
    pipeline_id: 'minimaliste',
    display_id: 'minimalist-legacy',
    label_en: 'Minimalist (legacy)',
    label_fr: 'Minimaliste (legacy)',
    description_en: 'Legacy minimalist slot — redirected to Minimalist style.',
    description_fr: 'Slot minimaliste historique — redirigé vers Minimaliste.',
    prompt_style: 'minimal clean background, soft gradient, pastel tones, negative space',
    badge_color: '#94a3b8',
    gradient: 'from-stone-200/60 via-stone-100/40 to-emerald-100/30',
    best_for_en: ['legacy content'],
    best_for_fr: ['contenu legacy'],
    fal_model: 'fal-ai/flux-pro/v1.1',
  },
  'infographie': {
    pipeline_id: 'infographie',
    display_id: 'motion-design-legacy',
    label_en: 'Infographics (legacy)',
    label_fr: 'Infographie (legacy)',
    description_en: 'Legacy infographics slot — redirected to Motion Design.',
    description_fr: 'Slot infographie historique — redirigé vers Motion Design.',
    prompt_style: 'modern infographic, animated charts, flat icons, blue/cyan palette, data visualization',
    badge_color: '#60a5fa',
    gradient: 'from-blue-500/30 via-cyan-500/20 to-sky-400/20',
    best_for_en: ['legacy content'],
    best_for_fr: ['contenu legacy'],
    fal_model: null,
  },
}

/** Ordered list of the 8 styles we surface in 2026 UI (pipeline IDs). */
export const SURFACED_STYLES: ContentTemplateStyle[] = [
  'cinematique',
  'stock-vo',
  'whiteboard',
  'stickman',
  'flat-design',
  '3d-pixar',
  'motion-graphics',
  'animation-2d',
]

/** Resolve display label for a pipeline style ID. */
export function getStyleLabel(style: ContentTemplateStyle, lang: ContentLang = 'fr'): string {
  const meta = FACELESS_STYLES_META[style]
  if (!meta) return style
  return lang === 'fr' ? meta.label_fr : meta.label_en
}

/** Resolve display description for a pipeline style ID. */
export function getStyleDescription(style: ContentTemplateStyle, lang: ContentLang = 'fr'): string {
  const meta = FACELESS_STYLES_META[style]
  if (!meta) return ''
  return lang === 'fr' ? meta.description_fr : meta.description_en
}

/** Tailwind gradient for a style card header. */
export function getStyleGradient(style: ContentTemplateStyle): string {
  return FACELESS_STYLES_META[style]?.gradient
    ?? 'from-slate-400/30 via-slate-300/20 to-zinc-400/20'
}

/** Short visual descriptor used in the auto-generated template description. */
const STYLE_VISUAL_DESCRIPTORS: Record<ContentTemplateStyle, { en: string; fr: string }> = {
  'cinematique': {
    en: 'AI cinematic visuals, dramatic lighting, photorealistic 8K compositions, film-grain texture',
    fr: 'visuels cinématiques IA, éclairage dramatique, compositions photoréalistes 8K, grain filmique',
  },
  'stock-vo': {
    en: 'stock documentary footage with voiceover, broadcast-quality framing, archival feel',
    fr: 'images documentaires stock avec voix off, cadrage broadcast, impression archive',
  },
  'whiteboard': {
    en: 'dark moody atmosphere, deep shadows, noir aesthetic, fog and tension — horror cinematic',
    fr: 'atmosphère sombre, ombres profondes, esthétique noir, brouillard et tension cinématique',
  },
  'stickman': {
    en: 'manga-style comic panels, clean line art, speech bubbles, expressive characters',
    fr: 'planches BD façon manga, traits nets, bulles de texte, personnages expressifs',
  },
  'flat-design': {
    en: 'minimalist clean backgrounds, bold typography, soft pastel gradients, generous negative space',
    fr: 'fonds minimalistes épurés, typographie bold, dégradés pastel doux, espace négatif généreux',
  },
  '3d-pixar': {
    en: '3D-rendered characters, soft ambient occlusion, playful toy-like aesthetic, isometric perspective',
    fr: 'personnages 3D rendus, ambient occlusion doux, esthétique ludique, perspective isométrique',
  },
  'motion-graphics': {
    en: 'animated shapes, kinetic typography, data visualizations, clean corporate palette',
    fr: 'formes animées, typographie cinétique, data-viz, palette corporate propre',
  },
  'animation-2d': {
    en: 'warm hand-drawn illustrations, watercolor texture, friendly characters, cozy palette',
    fr: 'illustrations dessinées chaleureuses, texture aquarelle, personnages amicaux, palette cosy',
  },
  'minimaliste': {
    en: 'minimalist composition, soft gradients, pastel tones, negative space',
    fr: 'composition minimaliste, dégradés doux, tons pastel, espace négatif',
  },
  'infographie': {
    en: 'animated infographic, charts and icons, blue/cyan data-viz palette',
    fr: 'infographie animée, graphiques et icônes, palette bleu/cyan',
  },
}

/**
 * Build a user-facing description shown in the "Content description" textarea
 * when the user picks a template.
 *
 * Focuses on: ambience, visuals, main message — NO script (script goes in the
 * script field below).
 */
export function buildTemplateDescription(t: ContentTemplate, lang: ContentLang = 'fr'): string {
  const niche = getNicheLabel(t.niche, lang).label.toLowerCase()
  const toneArr = tTone(t, lang).slice(0, 4)
  const tone = toneArr.join(', ')
  const visuals = STYLE_VISUAL_DESCRIPTORS[t.fal_style]?.[lang] ?? ''
  const structureValues = Object.values(t.structure_guide)
  const arcStart = structureValues[0]?.replace(/\s*\(\d+s?\)\s*$/, '').toLowerCase() ?? ''
  const arcEnd   = structureValues[structureValues.length - 1]?.replace(/\s*\(\d+s?\)\s*$/, '').toLowerCase() ?? ''
  const name = tName(t, lang)

  if (lang === 'fr') {
    return `Vidéo ${niche} inspirée du template "${name}".

Ambiance : ${tone}.

Visuel : ${visuals}. ${t.recommended_scene_count} scènes rythmées.

Message principal : partir de "${arcStart}" pour amener le spectateur vers "${arcEnd}".`
  }

  return `${name} — ${niche} video format.

Tone: ${tone}.

Visuals: ${visuals}. ${t.recommended_scene_count} scenes, tight pacing.

Core arc: start from "${arcStart}" and lead the viewer to "${arcEnd}".`
}
