// ── CLYRO — Centralized Claude prompts ────────────────────────────────────────
// Single source of truth for all AI prompts. Edit here to version/A-B test them.

// STYLE_VISUAL_GUIDE is now imported from @clyro/shared so all storyboard
// generators (this one, services/claude.ts, and apps/web/.../generate-storyboard)
// stay in sync. Two thinner copies in this file and in the Next.js route used
// to drift, causing the "image quality regression" reported in prod.
import { STYLE_VISUAL_GUIDE, detectLanguage, type DetectedLanguage } from '@clyro/shared'
export { STYLE_VISUAL_GUIDE }

export const SCENE_COUNT: Record<string, number> = {
  '6s':   2,
  '15s':  4,
  '30s':  6,
  '60s':  10,
  '90s':  14,
  '120s': 16,
  '180s': 22,
  '300s': 36,
  // 'auto' is computed dynamically from script word count at call time.
  'auto': 0,
}

/** Natural French voiceover speed (words per minute) — used to estimate
 *  duration from a script when duration is 'auto'. */
const WPM_FR = 150
/** Target words per scene when in auto mode — gives scenes of ~6-10s at 150 wpm. */
const WORDS_PER_SCENE_AUTO = 22

/** Estimates the scene count + target duration from a script's word count.
 *  Produces at least 3 scenes and at most 60 (token-safe ceiling for haiku). */
export function computeAutoSceneCount(script: string): { sceneCount: number; estimatedSeconds: number } {
  const words = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = Math.max(6, Math.round((words / WPM_FR) * 60))
  const sceneCount = Math.max(3, Math.min(60, Math.ceil(words / WORDS_PER_SCENE_AUTO)))
  return { sceneCount, estimatedSeconds }
}

// ── Storyboard ─────────────────────────────────────────────────────────────────

export interface StoryboardPromptParams {
  script: string
  style: string
  duration: string
  title?: string
  description?: string
}

export function buildStoryboardPrompts(p: StoryboardPromptParams): { system: string; user: string } {
  const isAuto = p.duration === 'auto'
  // Scene count always derives from the script's word count — duration only
  // controls timing/condensation rules, not how many scenes are created.
  const auto = computeAutoSceneCount(p.script)
  const sceneCount = auto.sceneCount
  const styleGuide = STYLE_VISUAL_GUIDE[p.style] ?? 'professional visual composition'
  const scriptLines = p.script.split('\n')
  const hasDialogue = scriptLines.some((l) => /^—|^–/.test(l.trim()) || /^[A-ZÀ-Ü][a-zà-ü]+\s*:/.test(l.trim()) || /["«].*["»]/.test(l.trim()))

  // Detect the script's language so the narration is preserved verbatim
  // (was hardcoded to French → silently translated non-French scripts).
  const lang: DetectedLanguage = detectLanguage(p.script)

  const system = `You are an expert video producer and visual storyteller.
You generate precise, professional storyboards for faceless videos (no on-camera presenter).
You reply ONLY with valid JSON, no markdown, no comments.`

  // Rule 4/5 change shape in auto-mode: the script drives the duration,
  // not a fixed target. We still give Claude a soft scene-count hint so it
  // knows roughly how many scenes to produce for a script of this length.
  const durationInstruction = isAuto
    ? `4. The total duration must FAITHFULLY reflect the script length (~150 wpm spoken). Do NOT condense, do NOT shorten — every sentence is narrated in full.
5. Sum of duree_estimee must be consistent with the script length (~${auto.estimatedSeconds}s estimated). Adjust naturally per scene.`
    : `4. The total duration must FAITHFULLY reflect the script length (~150 wpm spoken). Do NOT condense — every sentence is narrated in full.
5. Sum of duree_estimee must be consistent with the script length (~${auto.estimatedSeconds}s estimated). Adjust naturally per scene.`

  const user = `OUTPUT LANGUAGE — STRICT
All narration text and on-screen copy fields (texte_voix, etc.) MUST be written in ${lang.name} (${lang.code}). Do NOT translate to French, English, or any other language regardless of the language used elsewhere in these instructions. The visual prompt fields (description_visuelle, animation_prompt) remain in English because downstream image/video models only understand English.

Break this script into roughly ${sceneCount} visual scenes for a "${p.style}" style video.${p.title ? `\nTitle: "${p.title}"` : ''}
${p.description ? `\nVISUAL CONTEXT (characters, setting, mood):\n${p.description}\n→ Integrate these into description_visuelle when relevant (skin tone, clothing, setting).` : ''}
${hasDialogue ? `\nDIALOGUE MODE DETECTED: the script contains dialogue between multiple speakers.
SPECIAL RULES:
- Detect each speaker (format: "Name:" or "— Name" or quoted)
- Every line MUST include a "speaker" field with the character's name
- Alternating dialogues → create separate scenes per speaker to enable different voices
- description_visuelle MUST include ALL visible characters in the scene` : ''}

REQUIRED VISUAL STYLE for description_visuelle: ${styleGuide}

For each scene, produce:
- "index": scene number (starts at 0)
- "description_visuelle": visual prompt in ENGLISH for Flux (40–80 words sweet spot, hard cap 150 chars). MUST follow the 4-LAYER STRUCTURE below and the visual style above. Describe ONLY the unique visual content of this scene — WHO is visible, WHAT happens, WHERE. Each scene must be visually distinct.
- "animation_prompt": camera/motion prompt in ENGLISH for image-to-video (max 80 chars). Describes ONE primary subject motion + ONE camera move, ending with "smooth cinematic motion".
- "texte_voix": REQUIRED — narration written in ${lang.name} (the script's language). NEVER translate. Always filled, never empty.
- "duree_estimee": duration in seconds (integer, between 3 and 12)
- "overlay" (OPTIONAL): one object { type, text, position?, trigger_word?, duration_seconds? } with type ∈ stat | headline | key_phrase | comparison | list_item | source | cta. Use stat for any number, headline for section starts, key_phrase for the most quotable line, comparison for "A | B" contrasts, list_item for "#3 — TOPIC" lists, source for citations, cta for closing call-to-action. text stays in ${lang.name}. trigger_word = the word in texte_voix that triggers it.
${hasDialogue ? `- "speaker": NAME of the speaking character. Optional for narration, REQUIRED for dialogue.` : ''}

═══════════════════════════════════════════════════════════════════════
4-LAYER STRUCTURE for description_visuelle (mandatory order):
  1. SUBJECT     — main visual element with specific attributes
  2. ENVIRONMENT — background, secondary elements, spatial context
  3. LIGHTING    — direction, temperature, atmosphere (e.g. "warm directional light, dramatic shadows")
  4. TECHNICAL   — camera/lens/finish (e.g. "shot on Canon R5, 85mm, shallow DoF, 8K, photorealistic")
NEVER mention identifiable real people — use hands, silhouettes, objects, abstract shapes.
If the scene has a stat / headline / key_phrase overlay, INCLUDE the phrase
"with negative space in [center|upper third|lower third] for text overlay" in the ENVIRONMENT layer.
End every prompt with "8K".
═══════════════════════════════════════════════════════════════════════

RULES:
1. description_visuelle = unique visual content per scene (subject + action + setting). MUST follow the visual style. Good examples: "scientist examining glowing DNA strand in dark lab", "crowd celebrating in sunlit city square". Bad: generic shots with no specifics.
2. animation_prompt MUST describe a CONCRETE motion (never "smooth animation" alone)
3. texte_voix is REQUIRED — distribute the full script across all scenes in ${lang.name}${isAuto ? ', omitting nothing' : ''}
${durationInstruction}
${hasDialogue ? `6. DIALOGUES: when two characters speak in succession, prefer separate scenes per line (enables different voices)` : ''}

Script (treat as ${lang.name} content — preserve verbatim across texte_voix fields):
"""
${p.script}
"""

Reply ONLY with this JSON:
{
  "scenes": [...],
  "total_duration": <sum of durations>
}`

  return { system, user }
}

// ── Motion Storyboard ──────────────────────────────────────────────────────────

export interface MotionStoryboardPromptParams {
  brief: string
  script: string
  format?: string
  duration?: string
}

export const MOTION_SYSTEM_PROMPT = `Tu es un directeur artistique expert en motion design vidéo.

Ta mission : analyser un brief visuel et un script de voix off, puis générer un storyboard JSON structuré pour une vidéo animée avec Remotion.

RÈGLES STRICTES :
1. Découpe le script en 4 à 8 scènes narratives cohérentes.
2. Chaque scène correspond à une phrase ou un bloc de phrases du script.
3. texte_voix = extrait exact du script pour cette scène (max 20 mots).
4. text = titre court et impactant pour la scène (max 6 mots, peut différer de texte_voix).
5. subtext = complément visuel court (max 12 mots, optionnel mais recommandé).
6. highlight = UN seul mot de "text" qui sera mis en gradient coloré. Doit être un mot exact présent dans "text".
7. icon = un seul emoji représentatif du concept de la scène.
8. style = choix narratif : "hero" → ouverture forte | "feature" → point clé | "stats" → données chiffrées | "text-focus" → citation forte | "outro" → conclusion CTA
9. duree_estimee = durée en secondes (3 à 8s selon longueur texte_voix).
10. accent_color = couleur hex harmonieuse au brief (#00CFFF, #9B59FF, #FF6B6B, #00C896, #FFB347...).
11. Pour "stats" : ajoute un tableau "stats" avec 2 à 4 objets { value, label }.
12. La progression doit suivre : hero → feature(s) → [stats?] → outro.

RÉPONDS UNIQUEMENT avec du JSON valide. Aucun texte avant ou après.

Format exact :
{
  "scenes": [
    {
      "index": 1,
      "texte_voix": "...",
      "duree_estimee": 5,
      "text": "...",
      "subtext": "...",
      "highlight": "...",
      "icon": "...",
      "style": "hero",
      "accent_color": "#00CFFF"
    }
  ]
}`

export function buildMotionStoryboardUserPrompt(p: MotionStoryboardPromptParams): string {
  return `BRIEF VISUEL :
${p.brief.trim()}

SCRIPT VOIX OFF :
${p.script.trim()}

${p.format ? `Format vidéo : ${p.format}` : ''}
${p.duration ? `Durée cible : ${p.duration}` : ''}

Génère le storyboard Remotion JSON.`
}

// ── Improve Prompt ─────────────────────────────────────────────────────────────

export interface ImprovePromptParams {
  prompt: string
  style: string
  feedback?: string
  hasImage?: boolean
}

export function buildImprovePromptContent(p: ImprovePromptParams): string {
  const feedbackLine = p.feedback?.trim() ? `\nUser feedback: "${p.feedback.trim()}"` : ''
  return `You are an expert AI prompt engineer specializing in image generation for ${p.style}-style video production.

Current image prompt: "${p.prompt}"
Visual style: ${p.style}${feedbackLine}${p.hasImage ? '\n\nI have included the current generated image above for reference.' : ''}

Improve this image generation prompt to produce a better, more cinematic and visually striking result.
Focus on: composition, lighting, mood, specific visual details that match the "${p.style}" style.

Respond ONLY with valid JSON:
{
  "improvedPrompt": "the improved prompt in English (max 150 chars)",
  "explanation": "brief explanation of what changed and why (1-2 sentences in French)",
  "keyChanges": ["change 1", "change 2", "change 3"]
}`
}

// ── Regen Scene Prompts ────────────────────────────────────────────────────────

export function buildRegenScenePromptsContent(scriptText: string, style: string): string {
  return `For this scene text: "${scriptText.slice(0, 300)}"
Style: ${style}

Generate:
- imagePrompt: visual description in English for fal.ai Flux image generation (max 120 chars, match the ${style} style)
- animationPrompt: camera movement / motion description for Kling i2v (max 70 chars, concrete action)

Respond ONLY with: {"imagePrompt":"...","animationPrompt":"..."}`
}

// ── Brand Analyst ──────────────────────────────────────────────────────────────

export interface BrandBriefInput {
  name: string
  secteur: string
  cible: string
  valeurs: string[]
  ambiance: string
  couleurs_imposees?: string
  concurrents?: string
  references?: string
}

export function buildBrandAnalystPrompts(brief: BrandBriefInput): { system: string; user: string } {
  const system = `Tu es un Brand Analyst expert. Tu réponds UNIQUEMENT en JSON valide, sans markdown.`
  const user = `Tu es un Brand Analyst expert. Analyse ce brief de marque et retourne une évaluation structurée.

BRIEF :
- Nom : ${brief.name}
- Secteur : ${brief.secteur}
- Cible : ${brief.cible}
- Valeurs : ${brief.valeurs.join(', ')}
- Ambiance : ${brief.ambiance}
${brief.couleurs_imposees ? `- Couleurs imposées : ${brief.couleurs_imposees}` : ''}
${brief.concurrents ? `- Concurrents : ${brief.concurrents}` : ''}
${brief.references ? `- Références : ${brief.references}` : ''}

Analyse le brief et retourne :

1. brief_quality : évalue si le brief est 'sufficient' ou 'insufficient'
   - 'sufficient' si le brief contient assez de détails pour générer des directions cohérentes
   - 'insufficient' si le brief est vague ou trop court (ex: juste quelques mots)

2. Si brief_quality === 'insufficient', génère 2-3 clarification_questions précises et actionables

3. Détecte les CONTRADICTIONS (ex: ambiance luxe + secteur discount, ou "minimalist mais coloré et fun")
   - Si une contradiction existe, définis 2 chemins créatifs différents pour la résoudre
   - Exemple : "luxury minimalist" peut se résoudre comme:
     * Path A: Minimalisme LUXE (sobriété dorée, qualité over quantity)
     * Path B: Minimalisme FUN (épuré mais avec couleurs vives et détails ludiques)

4. Analyse aussi :
   - Les informations MANQUANTES qui affaibliraient les directions créatives
   - Les QUESTIONS DE CLARIFICATION (seulement si vraiment nécessaires)

Règles :
- Si une contradiction majeure existe → has_contradiction: true + 2 chemins créatifs distincts
- Si le brief est cohérent → has_contradiction: false
- brief_score = 0-100 (100 = brief parfait)
- is_ready = true seulement si brief_quality suffisant ET pas de contradiction majeure

Réponds UNIQUEMENT avec ce JSON valide :
{
  "brief_quality": "sufficient" | "insufficient",
  "clarification_questions": ["Question 1 ?", "Question 2 ?"],
  "is_ready": true/false,
  "brief_score": 85,
  "contradictions": ["..."],
  "has_contradiction": false,
  "contradiction_paths": [],
  "questions": ["Question 1 ?", "Question 2 ?"],
  "suggestions": ["Suggestion d'amélioration..."]
}

Format de contradiction_paths (UNIQUEMENT si has_contradiction === true) :
{
  "contradiction_paths": [
    {
      "label": "Path A: Nom court de la direction",
      "description": "Explication claire de cette interprétation (1-2 phrases)",
      "resolution": "Directive créative précise pour cette résolution (2-3 mots clés, ex: 'luxury, refined, golden')"
    },
    {
      "label": "Path B: Nom court de la direction",
      "description": "Explication claire de cette interprétation (1-2 phrases)",
      "resolution": "Directive créative précise pour cette résolution (2-3 mots clés, ex: 'vibrant, playful, bold')"
    }
  ]
}`
  return { system, user }
}

// ── Brand Strategy ─────────────────────────────────────────────────────────────

export const AMBIANCE_GUIDE: Record<string, string> = {
  luxe:       'haut de gamme, élégant, intemporel, sobriété raffinée, palettes sombres ou dorées',
  accessible: 'chaleureux, humain, inclusif, couleurs douces, typographies rondes et lisibles',
  tech:       'moderne, épuré, innovant, dark mode, géométrique, monochrome + accent néon',
  naturel:    'organique, durable, terre, tons naturels, matières, minimalisme bienveillant',
  fun:        'coloré, énergique, jeune, expressif, contrastes forts, irrévérencieux',
  corporate:  'professionnel, fiable, structuré, navy / blanc / gris, sobre et clair',
}

export const BRAND_STRATEGY_SYSTEM = `Tu es un directeur artistique senior et brand strategist avec 20 ans d'expérience.\nTu génères des identités visuelles de marque complètes, précises et différenciées.\nTu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

export function buildBrandStrategyUserPrompt(brief: BrandBriefInput): string {
  const ambianceGuide = AMBIANCE_GUIDE[brief.ambiance] ?? brief.ambiance
  const couleursContext = brief.couleurs_imposees ? `\nCOULEURS IMPOSÉES : ${brief.couleurs_imposees} — chaque direction DOIT intégrer ces couleurs comme couleur primary ou accent.` : ''
  const referencesContext = brief.references ? `\nRÉFÉRENCES VISUELLES : ${brief.references} — s'en inspirer sans copier.` : ''
  const concurrentsContext = brief.concurrents ? `\nCONCURRENTS À ÉVITER : ${brief.concurrents} — ne pas ressembler à ces marques.` : ''

  return `Génère une stratégie de marque complète pour :

MARQUE : ${brief.name}
SECTEUR : ${brief.secteur}
CIBLE : ${brief.cible}
VALEURS : ${brief.valeurs.join(', ')}
AMBIANCE : ${brief.ambiance} — ${ambianceGuide}${couleursContext}${referencesContext}${concurrentsContext}

Génère exactement 3 directions créatives distinctes et contrastées, plus la voix de marque.

Chaque direction doit avoir :
- "id": "direction_1", "direction_2", ou "direction_3"
- "name": nom créatif de la direction (ex: "L'Élégance Minimaliste")
- "tagline": slogan court percutant (max 8 mots)
- "positioning": positionnement de marque (2-3 phrases)
- "palette": { "primary": "#HEX", "secondary": "#HEX", "accent": "#HEX", "neutral": "#HEX", "background": "#HEX", "description": "..." }
- "typography": { "heading": "nom de police Google Fonts", "body": "nom de police Google Fonts", "description": "..." }
- "mood": description du mood board (3-4 phrases evocatrices)
- "keywords": 5 mots-clés visuels en français

La voix de marque :
- "tone": description du ton éditorial
- "examples": 3 exemples de phrases dans ce ton
- "dos": 4 choses à faire dans la communication
- "donts": 4 choses à éviter absolument

RÈGLES CRITIQUES :
1. Les 3 directions doivent être TRÈS DIFFÉRENTES entre elles (palette, mood, typographie)
2. Les couleurs HEX doivent être précises et esthétiquement cohérentes
3. Utilise uniquement des polices disponibles sur Google Fonts
4. Le positionnement doit être spécifique au secteur "${brief.secteur}"

Réponds UNIQUEMENT avec ce JSON valide :
{
  "directions": [ {...direction_1...}, {...direction_2...}, {...direction_3...} ],
  "voice": { "tone": "...", "examples": [...], "dos": [...], "donts": [...] }
}`
}

// ── Brand Charte ───────────────────────────────────────────────────────────────

export interface BrandDirectionInput {
  name: string
  positioning: string
  palette: { primary: string; secondary: string; accent: string; neutral: string; background: string }
  typography: { heading: string; body: string }
}

export function buildBrandChartePrompts(brief: BrandBriefInput, direction: BrandDirectionInput): { system: string; user: string } {
  const system = `Tu es un directeur artistique expert en brand design. Tu génères des chartes graphiques professionnelles. Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`
  const user = `Rédige une charte graphique complète et professionnelle pour la marque "${brief.name}".

DIRECTION CRÉATIVE SÉLECTIONNÉE : "${direction.name}"
POSITIONNEMENT : ${direction.positioning}
SECTEUR : ${brief.secteur}
CIBLE : ${brief.cible}

PALETTE DE COULEURS :
- Primaire : ${direction.palette.primary}
- Secondaire : ${direction.palette.secondary}
- Accent : ${direction.palette.accent}
- Neutre : ${direction.palette.neutral}
- Fond : ${direction.palette.background}

TYPOGRAPHIE :
- Titres : ${direction.typography.heading}
- Corps : ${direction.typography.body}

Génère une charte graphique détaillée avec :

1. "logo_rules" : règles d'usage du logo
   - "clear_space": distance minimale autour du logo
   - "allowed_backgrounds": liste de 4 fonds autorisés
   - "forbidden": liste de 4 interdits absolus

2. "colors": tableau de toutes les couleurs de la palette avec pour chaque :
   - "name": nom de la couleur (ex: "Bleu Nuit")
   - "hex": code HEX
   - "rgb": code RGB
   - "usage": usage principal (1-2 phrases)

3. "typography": hiérarchie typographique complète
   - "heading": { "font": "...", "weight": "Bold 700", "sizes": "48px / 36px / 28px", "usage": "..." }
   - "body": { "font": "...", "weight": "Regular 400 / Medium 500", "sizes": "16px / 14px", "usage": "..." }
   - "caption": { "font": "...", "weight": "Regular 400", "sizes": "12px / 11px", "usage": "..." }

4. "layout": système de mise en page
   - "grid": description de la grille
   - "spacing": unité de base et progression
   - "margins": marges de sécurité recommandées

5. "photography": direction artistique photo
   - "style": style photographique (2-3 phrases)
   - "mood": ambiance et émotions recherchées
   - "forbidden": 3 types de photos à proscrire

Réponds UNIQUEMENT avec ce JSON valide et complet.`
  return { system, user }
}

// ── Brand Hybrid ───────────────────────────────────────────────────────────────

export interface BrandHybridParams {
  brandName: string
  secteur: string
  paletteDirName: string
  palette: object
  typHeading: string
  typBody: string
  logoKeywords?: string[]
  logoMood?: string
}

export function buildBrandHybridUserPrompt(p: BrandHybridParams): string {
  return `Tu es un directeur artistique. Crée une direction hybride cohérente en combinant des éléments de plusieurs directions créatives.

MARQUE : ${p.brandName} (${p.secteur})

PALETTE choisie (de "${p.paletteDirName}") :
${JSON.stringify(p.palette, null, 2)}

TYPOGRAPHIE choisie :
- Titres : ${p.typHeading}
- Corps : ${p.typBody}
${p.logoKeywords ? `
STYLE LOGO (inspiration) :
- Keywords : ${p.logoKeywords.join(', ')}
- Mood : ${p.logoMood ?? 'à déterminer'}
` : ''}
Génère une direction hybride qui harmonise ces éléments. Assure-toi que :
1. La palette et la typographie choisies s'accordent visuellement
2. Le mood reflète la combinaison des deux directions
3. Les keywords sont cohérents avec l'ensemble

Réponds UNIQUEMENT avec ce JSON valide (format BrandDirection) :
{
  "id": "direction_hybrid",
  "name": "Direction Hybride",
  "tagline": "...",
  "positioning": "...",
  "palette": { "primary": "#HEX", "secondary": "#HEX", "accent": "#HEX", "neutral": "#HEX", "background": "#HEX", "description": "..." },
  "typography": { "heading": "${p.typHeading}", "body": "${p.typBody}", "description": "..." },
  "mood": "...",
  "keywords": ["...", "...", "...", "...", "..."]
}`
}

// ── URL-to-Script (blog → faceless video) ──────────────────────────────────────
// Audit P2: Pictory's moat is URL ingestion. This prompt turns a scraped article
// into a natural spoken script formatted for the standard faceless pipeline.

export type UrlToScriptLength = 'short' | 'medium' | 'long'

export interface UrlToScriptParams {
  sourceUrl: string
  title?: string
  description?: string
  content: string
  targetLanguage?: 'fr' | 'en'
  length?: UrlToScriptLength
}

const LENGTH_TARGETS: Record<UrlToScriptLength, { seconds: number; words: number; label: string }> = {
  short:  { seconds: 30,  words: 75,  label: '~30 s (TikTok/Reels)' },
  medium: { seconds: 60,  words: 150, label: '~60 s (équilibré)' },
  long:   { seconds: 120, words: 300, label: '~2 min (YouTube Shorts long)' },
}

export function buildUrlToScriptPrompts(p: UrlToScriptParams): { system: string; user: string } {
  const length = p.length ?? 'medium'
  const target = LENGTH_TARGETS[length]
  const lang = p.targetLanguage ?? 'fr'

  const system = `Tu es un scénariste vidéo expert en vulgarisation et en formats courts (TikTok, Reels, Shorts).
Tu transformes des articles de blog ou pages web en scripts de voix-off naturels, engageants et concis.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const langInstruction = lang === 'en'
    ? 'Réponds en ANGLAIS (le script final doit être en anglais naturel, parlé).'
    : 'Réponds en FRANÇAIS (le script final doit être en français naturel, parlé).'

  const user = `Transforme ce contenu web en un SCRIPT de voix-off pour vidéo faceless.

DURÉE CIBLE : ${target.label} — environ ${target.words} mots.
LANGUE : ${langInstruction}

RÈGLES :
- Ouvre avec un hook fort (1 phrase qui accroche en 3 s).
- Utilise un ton conversationnel, pas journalistique. "Tu" / "vous" plutôt que "on".
- Phrases courtes (< 15 mots) adaptées à la narration orale.
- Pas de listes à puces, pas de markdown, pas de titres — prose pure.
- Pas de mentions "dans cet article" ou "selon l'auteur" : reformule comme une vidéo originale.
- Termine par un CTA simple (1 phrase : "Abonne-toi", "Essaye-le", "Dis-moi en commentaire", etc.).
- Cite ${p.sourceUrl} comme source dans le champ "attribution", pas dans le script.

SOURCE :
URL : ${p.sourceUrl}
${p.title ? `Titre : ${p.title}\n` : ''}${p.description ? `Description : ${p.description}\n` : ''}
CONTENU EXTRAIT :
"""
${p.content.slice(0, 8000)}
"""

Réponds UNIQUEMENT avec ce JSON valide :
{
  "title": "titre accrocheur pour la vidéo (max 70 car.)",
  "script": "script complet prêt pour TTS, ${target.words}±20 mots",
  "hook": "la première phrase du script, isolée",
  "cta": "la dernière phrase du script, isolée",
  "estimatedSeconds": nombre,
  "wordCount": nombre,
  "attribution": "Source : ${p.sourceUrl}"
}`

  return { system, user }
}
