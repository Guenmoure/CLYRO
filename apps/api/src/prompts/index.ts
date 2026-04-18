// ── CLYRO — Centralized Claude prompts ────────────────────────────────────────
// Single source of truth for all AI prompts. Edit here to version/A-B test them.

// ── Shared style guides ────────────────────────────────────────────────────────

export const STYLE_VISUAL_GUIDE: Record<string, string> = {
  'cinematique':     'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain — movie still quality, NO illustration',
  'stock-vo':        'National Geographic style, natural light, realistic textures, real-world documentary scene — fully photorealistic, no illustration',
  'whiteboard':      'hand-drawn sketch on whiteboard, black marker on plain white — NO color fills, rough strokes only, RSA Animate educational style',
  'stickman':        'black stick figures on white background, RSA animate bonhommes style — NO fills, bold expressive line drawing',
  'flat-design':     'flat vector illustration, bold solid colors, no shadows, no gradients, Dribbble-quality SVG aesthetic',
  'infographie':     'flat icon infographic, data visualization chart, color-coded sections, isometric perspective — B2B professional',
  '3d-pixar':        'Pixar-style 3D CGI render, claymation texture, rounded characters, soft studio lighting — Disney Pixar quality',
  'motion-graphics': 'flat design motion graphics, geometric shapes, vibrant vector colors, bold typography, kinetic composition',
  'animation-2d':    'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors — absolutely NO photorealism',
  'minimaliste':     'simple black line art on white background, minimalist stickman — NO fills, ultra clean linework',
  'corporate':       'clean corporate illustration, navy blue / white palette, minimal geometric shapes — professional B2B',
  'dynamique':       'high-energy composition, motion blur, neon accents on dark background, diagonal lines — sports action',
  'luxe':            'luxury brand photography, gold and black palette, bokeh, marble surfaces — high-fashion editorial',
  'fun':             'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti — kawaii cheerful style',
}

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

/** Estimates the scene count + target duration from a script's word count,
 *  used when the caller passes duration='auto'. Produces at least 3 scenes
 *  and at most 40 (safety bound). */
export function computeAutoSceneCount(script: string): { sceneCount: number; estimatedSeconds: number } {
  const words = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = Math.max(6, Math.round((words / WPM_FR) * 60))
  const sceneCount = Math.max(3, Math.min(40, Math.ceil(words / WORDS_PER_SCENE_AUTO)))
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

  const system = `Tu es un expert en production vidéo et en storytelling visuel.\nTu génères des storyboards précis et professionnels pour des vidéos sans présentateur.\nTu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  // Rule 4/5 change shape in auto-mode: the script drives the duration,
  // not a fixed target. We still give Claude a soft scene-count hint so it
  // knows roughly how many scenes to produce for a script of this length.
  const durationInstruction = isAuto
    ? `4. La durée totale doit refléter FIDÈLEMENT la longueur réelle du script (~150 mots/minute à voix haute). Ne condense PAS, ne raccourcis PAS — chaque phrase du script est narrée en entier.
5. La somme des duree_estimee doit être cohérente avec la longueur du script (~${auto.estimatedSeconds}s estimé). Ajuste naturellement scène par scène.`
    : `4. La durée totale doit refléter FIDÈLEMENT la longueur réelle du script (~150 mots/minute à voix haute). Ne condense PAS — chaque phrase est narrée en entier.
5. La somme des duree_estimee doit être cohérente avec la longueur du script (~${auto.estimatedSeconds}s estimé). Ajuste naturellement scène par scène.`

  const user = `Découpe ce script en environ ${sceneCount} scènes visuelles pour une vidéo de style "${p.style}".${p.title ? `\nTitre : "${p.title}"` : ''}
${p.description ? `\nCONTEXTE VISUEL (personnages, décor, ambiance) :\n${p.description}\n→ Intègre ces éléments dans description_visuelle lorsque pertinent (couleur de peau, style vestimentaire, décor).` : ''}

STYLE VISUEL OBLIGATOIRE pour description_visuelle : ${styleGuide}
${hasDialogue ? `\nMODE DIALOGUE DÉTECTÉ : Le script contient des dialogues entre plusieurs personnages.
INSTRUCTIONS SPÉCIALES :
- Détecte chaque personnage / locuteur dans le script (format: "Nom:" ou "— Nom" ou guillemets)
- Chaque réplique / tour de parole DOIT inclure un champ "speaker" avec le nom du personnage
- Si dialogues alternés → crée des scènes séparées par locuteur pour permettre différentes voix
- Lorsqu'une scène montre une interaction, décris EXPLICITEMENT les personnages (position, expression, relation) dans description_visuelle
- La description_visuelle DOIT inclure TOUS les personnages visibles dans la scène` : ''}

Pour chaque scène, génère :
- "index": numéro de scène (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS optimisé pour Flux image generation (max 150 chars). DOIT respecter le style ci-dessus.
- "animation_prompt": prompt de mouvement en ANGLAIS pour image-to-video (max 80 chars). Décrit le mouvement de caméra et l'action concrète.
- "texte_voix": OBLIGATOIRE — texte narré en français pendant cette scène. Jamais vide.
- "duree_estimee": durée en secondes (entier, entre 3 et 12)
${hasDialogue ? `- "speaker": NOM du personnage parlant (ex: "Alice", "Bob"). Optionnel pour narration, OBLIGATOIRE pour dialogues.` : ''}

RÈGLES :
1. description_visuelle DOIT coller au style "${p.style}" — applique strictement : ${styleGuide}
2. animation_prompt DOIT décrire un mouvement CONCRET (jamais "smooth animation" seul)
3. texte_voix est OBLIGATOIRE — distribue le script complet sur toutes les scènes${isAuto ? ' sans rien omettre' : ''}
${durationInstruction}
${hasDialogue ? `6. DIALOGUES : si deux personnages parlent successivement, favorise des scènes séparées pour chaque réplique (permet voix différentes)` : ''}

Script :
"""
${p.script}
"""

Réponds UNIQUEMENT avec ce JSON :
{
  "scenes": [...],
  "total_duration": <somme des durées>
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
