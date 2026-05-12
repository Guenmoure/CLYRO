// ── CLYRO — Centralized Claude prompts ────────────────────────────────────────
// Single source of truth for all AI prompts. Edit here to version/A-B test them.

// STYLE_VISUAL_GUIDE is now imported from @clyro/shared so all storyboard
// generators (this one, services/claude.ts, and apps/web/.../generate-storyboard)
// stay in sync. Two thinner copies in this file and in the Next.js route used
// to drift, causing the "image quality regression" reported in prod.
import {
  STYLE_VISUAL_GUIDE,
  detectLanguage,
  planSceneCount,
  STORYBOARD_WPM,
  type DetectedLanguage,
} from '@clyro/shared'
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

/**
 * Estime le nombre de scènes + durée à partir de la longueur du script.
 * Délègue à `planSceneCount` (shared) qui n'applique AUCUN plafond — la
 * durée vidéo est entièrement déterminée par la longueur du script.
 *
 * Garde la signature historique pour ne pas casser les callers existants.
 */
export function computeAutoSceneCount(script: string): { sceneCount: number; estimatedSeconds: number } {
  const plan = planSceneCount(script, 'auto')
  return { sceneCount: plan.sceneCount, estimatedSeconds: plan.estimatedSeconds }
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

CRITICAL RULE — Script preservation (NON-NEGOTIABLE):
The user's script MUST be preserved VERBATIM across the texte_voix fields.
→ Do NOT condense, do NOT summarize, do NOT skip any sentence.
→ The concatenation of all texte_voix fields, in order, MUST reconstruct the original script.
→ The video's duration is determined ENTIRELY by the script's length. There is no upper limit.
→ If the script is long, produce many scenes. If it's short, produce few. Always full coverage.

You reply ONLY with valid JSON, no markdown, no comments.`

  // Both modes now enforce the same rule: the script drives duration.
  // Auto vs fixed duration only changes the soft scene-count target.
  const durationInstruction = isAuto
    ? `4. The total duration must FAITHFULLY reflect the script length (~${STORYBOARD_WPM} wpm spoken). Do NOT condense, do NOT shorten — every sentence is narrated in full.
5. Sum of duree_estimee must be consistent with the script length (~${auto.estimatedSeconds}s estimated). Adjust naturally per scene.`
    : `4. The total duration must FAITHFULLY reflect the script length (~${STORYBOARD_WPM} wpm spoken). Do NOT condense — every sentence is narrated in full.
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
- "faceless_scene_type": one of "broll" | "infographic" | "typography" | "demo". Pick the template that fits this scene's purpose:
    • "broll"       — narrative atmospheric scene (no overlay, or a key_phrase / source). Rich detailed image, full frame.
    • "infographic" — scene illustrating a number / stat / comparison. Backdrop is a SILENT chart with negative space in the CENTER for the overlay.
    • "typography"  — scene where the headline / key_phrase IS the content. Minimal / abstract backdrop with full-frame negative space.
    • "demo"        — scene about an interface, app or product. Image is a clean mockup with focused subject.
- "overlay" (OPTIONAL): one object { type, text, position?, trigger_word?, duration_seconds? } with type ∈ stat | headline | key_phrase | comparison | list_item | source | cta. Use stat for any number, headline for section starts, key_phrase for the most quotable line, comparison for "A | B" contrasts, list_item for "#3 — TOPIC" lists, source for citations, cta for closing call-to-action. text stays in ${lang.name}. trigger_word = the word in texte_voix that triggers it.
${hasDialogue ? `- "speaker": NAME of the speaking character. Optional for narration, REQUIRED for dialogue.` : ''}

═══════════════════════════════════════════════════════════════════════
4-LAYER STRUCTURE for description_visuelle (mandatory order):
  1. SUBJECT     — main visual element with specific attributes
  2. ENVIRONMENT — background, secondary elements, spatial context
  3. LIGHTING    — direction, temperature, atmosphere (e.g. "warm directional light, dramatic shadows")
  4. TECHNICAL   — camera/lens/finish (e.g. "shot on Canon R5, 85mm, shallow DoF, 8K, photorealistic")
NEVER mention identifiable real people — use hands, silhouettes, objects, abstract shapes.
End every prompt with "8K".

Adapt SUBJECT + ENVIRONMENT to faceless_scene_type:
  • broll       → rich narrative scene, no negative-space request
  • infographic → object/icon related to the data + "wide negative space in the CENTER for text overlay" in ENVIRONMENT
  • typography  → minimal abstract surface (smoke, gradient, light beam, single object) + "full-frame negative space for centered text" in ENVIRONMENT
  • demo        → clean device or interface mockup, focused subject, soft ambient light
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

// ── Brand Design Knowledge ─────────────────────────────────────────────────────
// Shared "design school" reference injected into every Claude prompt that
// generates brand identity. Distilled from Adobe Express' design fundamentals,
// type-pairing, and logo guides — re-expressed as MACHINE-ACTIONABLE rules
// (avoid generic "make it modern" prose). Strategy, charte and logo selection
// all reference this block so the model has shared vocabulary and shared
// constraints across the pipeline.

export const BRAND_DESIGN_PRINCIPLES = `
COMPOSITION FUNDAMENTALS — apply ALL of these to every output:

• EMPHASIS — chaque direction a UN point focal qui domine (couleur, échelle,
  contraste, texture, ou typo). Pas deux. Nomme-le explicitement.
• HIÉRARCHIE — classe les éléments par importance décroissante (titre > sous-titre
  > body > caption). L'ordre de lecture doit être prédictible en 1 coup d'œil.
• ÉCHELLE & PROPORTION — grand = important. Rapport titre/body ≥ 2.5×.
  Évite les échelles "moyennes" qui aplatissent la hiérarchie.
• CONTRASTE — typographique (light vs bold, serif vs sans), colorimétrique
  (WCAG AA ≥ 4.5:1), formel (rond vs angulaire). Au moins UN contraste fort
  par composition, sinon l'œil n'a pas d'accroche.
• RÉPÉTITION & MOTIF — un détail récurrent (couleur, forme, geste typo) crée
  l'unité visuelle entre des éléments disparates. Une charte sans répétition
  paraît bricolée.
• MOUVEMENT & RYTHME — le flux de lecture doit être intentionnel (Z-pattern,
  F-pattern, ou directionnel selon le médium). L'espacement crée le rythme.
• ÉQUILIBRE — symétrique (sobre, institutionnel) OU asymétrique (dynamique,
  moderne) — JAMAIS au hasard. Précise lequel par direction.
• ESPACE NÉGATIF — réserve ≥ 30 % de chaque composition à du vide intentionnel.
  Sur un logo : padding ≥ ½ hauteur du mark. Sur un layout : marges respiratoires.
• UNITÉ — visuelle (cohérence formelle) ET conceptuelle (l'identité raconte
  une seule histoire). Test final : si tu retires une direction du contexte,
  reconnaît-on la marque ?
`.trim()

export const COLOR_PSYCHOLOGY = `
COLOR PSYCHOLOGY — pèse 62-90 % de la perception d'une marque selon les études.
Aligne TOUJOURS la palette sur l'émotion ciblée :
  • Rouge      → passion, urgence, danger, appétit (food, sport, alerte)
  • Orange     → énergie, chaleur, créativité, abordable (loisirs, kids)
  • Jaune      → optimisme, soleil, jeunesse, attention (tech grand public, food)
  • Vert       → nature, santé, croissance, finance stable (wellness, eco, fintech)
  • Bleu       → confiance, sérénité, eau, tech (B2B SaaS, banque, santé)
  • Violet     → luxe, créativité, royauté, spiritualité (haut de gamme, beauté)
  • Rose       → tendresse, féminité, joie, ludique (lifestyle, cosmétique)
  • Noir       → sophistication, élégance, drame, autorité (luxe, mode, premium)
  • Blanc      → modernité, propreté, minimalisme, neutralité (tech, médical)
  • Marron/Beige → artisanat, naturel, authenticité (food artisanal, mode durable)
Évite la couleur qui contredit la valeur de marque (ex : ne JAMAIS choisir le
rouge "danger" pour une marque santé, le vert "argent" pour le luxe pur, etc.).
`.trim()

export const SHAPE_PSYCHOLOGY = `
SHAPE PSYCHOLOGY — chaque forme porte un sous-texte :
  • Carré / rectangle  → solide, fiable, équilibré, prévisible (institutionnel)
  • Cercle / arrondi   → humain, doux, continu, éternel (communauté, wellness)
  • Triangle           → direction, mouvement, stabilité, avertissement (action)
  • Spirale            → naturel, dynamique, spirituel (croissance, créatif)
  • Forme abstraite    → intellectuel, artistique, minimaliste (tech, art)
  • Forme organique    → naturel, vivant (alimentaire, eco, beauté)
Le geste du logo (angles vifs vs courbes) doit refléter la cible ET la USP.
`.trim()

export const LOGO_TYPES_GUIDE = `
LOGO TYPES — choisis le type qui sert la USP, pas le goût personnel :
  • LOGOTYPE (wordmark) — uniquement le nom en typo travaillée. À utiliser quand
    le nom est court (≤ 8 lettres), facile à prononcer, et que la USP est
    typographique (élégance, modernité). Ex : Google, Coca-Cola, FedEx.
  • LETTERMARK (monogramme) — initiales en composition graphique. Idéal pour
    les noms longs ou multi-mots. Souvent utilisé par les institutions et
    les chaînes (HBO, IBM, NASA, CNN).
  • LETTERFORM — UNE seule lettre. Pour les marques très installées ou comme
    déclinaison compacte (Netflix N, Pinterest P, McDonald's M).
  • PICTORIAL (symbole) — icône seule, sans texte. Ne marche QUE pour les
    marques déjà notoires (Apple, Nike swoosh, Twitter bird). Risqué en
    lancement — préférer un combination logo.
  • COMBINATION — icône + nom côte-à-côte ou empilés. Le plus polyvalent et
    le plus recommandé pour une marque qui démarre : on peut isoler chaque
    partie selon le contexte (favicon = icon, signature email = full).
  • EMBLEM — texte enchâssé DANS la forme (badges, sceaux). Évoque
    l'institution, l'artisanat, la tradition (universités, breweries, sport).
Critères de qualité (Adobe Express) : distinctif · mémorable · flexible
(scalable, monochrome OK) · fidèle à l'identité · intemporel.
`.trim()

export const BERTIN_VISUAL_VARIABLES = `
LES 8 VARIABLES VISUELLES (Jacques Bertin, "Sémiologie graphique", 1967) —
chaque marque visuelle disposée dans l'espace 2D peut varier sur 8 dimensions
indépendantes. Une identité visuelle FORTE en exploite explicitement 3-5 :
  • POSITION       — placement sur le plan (composition, alignement, axes)
  • TAILLE         — échelle relative des éléments → hiérarchie immédiate
  • VALEUR         — clair/sombre → contraste et profondeur sans recourir à la couleur
  • GRAIN          — texture, finesse de la trame → matière et tactilité
  • COULEUR        — teinte, saturation → émotion et catégorisation
  • ORIENTATION    — angle des éléments → mouvement, dynamisme
  • FORME          — silhouette de la tache → identité géométrique
  • (ANIMATION)    — si le médium le permet (web, motion) → 8e dimension
Question à se poser pour CHAQUE direction : laquelle de ces variables porte la
SIGNATURE de la marque ? Si la réponse est "couleur uniquement", l'identité
est fragile. Une marque forte joue sur ≥ 3 variables simultanément (ex : Nike
= forme + position + taille du swoosh ; Apple = forme + valeur + grain).
`.trim()

export const BRAND_SEMIOTICS_PRINCIPLES = `
SÉMIOTIQUE DU DESIGN DE MARQUE (Peirce / Greimas, théorie publique) — chaque
signe visuel se lit sur 3 niveaux que la direction doit articuler consciemment :

  1. SIGNIFIANT   — ce que l'œil voit (forme, couleur, typo, composition)
  2. SIGNIFIÉ DÉNOTATIF — la lecture littérale (un cercle bleu = "un cercle bleu")
  3. SIGNIFIÉ CONNOTATIF — les valeurs culturelles évoquées (un cercle bleu = sérénité,
     tech, infini, eau — DÉPEND DU CONTEXTE CULTUREL DE LA CIBLE)

TYPOLOGIE DES SIGNES (à choisir consciemment par direction) :
  • Signe ICONIQUE   — ressemble à son référent (un logo croissant pour boulangerie)
                       → lisibilité immédiate, faible originalité
  • Signe INDICIEL   — pointe vers son référent par lien causal (flèche = direction)
                       → mémorable, modérément culturel
  • Signe SYMBOLIQUE — relation arbitraire à son référent (swoosh Nike = victoire)
                       → fort capital de marque mais nécessite construction dans le temps

Une marque qui démarre privilégie souvent l'iconique (compréhensible vite) puis
construit le symbolique avec le temps. Précise dans positioning quel niveau
sémiotique est visé.

DISCOURS DE MARQUE — 3 axes à équilibrer :
  • Discours FONCTIONNEL : ce que la marque FAIT (utilité, performance)
  • Discours ÉMOTIONNEL  : ce que la marque FAIT RESSENTIR (joie, fierté, calme)
  • Discours IDENTITAIRE : ce que la marque DIT DE SON UTILISATEUR (statut, valeurs)
Identifie lequel domine pour la cible — sans les 3, l'identité paraît plate.
`.trim()

export const BRAND_ARCHITECTURE_GUIDE = `
ARCHITECTURES DE MARQUE (modèle d'Aaker, 1996 — théorie publique) — choisis la
structure qui sert la stratégie business, PAS l'esthétique :

  • MONOLITHIQUE (branded house) — une seule marque-mère pour tout (FedEx, Google,
    Virgin). Avantage : capital concentré, économies marketing. Risque : un
    scandale sur un produit affecte tout. Adapté quand l'USP est transverse.

  • ENDOSSÉE — la marque mère cautionne des sous-marques (Nestlé KitKat, Marriott
    Courtyard). Avantage : chaque sous-marque a sa personnalité + crédibilité
    parent. Risque : complexité de gouvernance.

  • MARQUES-PRODUIT (house of brands) — chaque marque est indépendante (P&G,
    Unilever). Avantage : segmentation fine. Risque : coût marketing × N.

  • SUB-BRANDING — la mère partage la scène avec un nom produit (Apple iPhone,
    Sony PlayStation). Avantage : récupère la notoriété mère + crée identité produit.

Précise dans positioning quelle architecture est envisagée — ça change radicalement
le logo (mono = wordmark fort ; endossée = combination avec mention parent ;
marque-produit = identité autonome).
`.trim()

export const TYPOGRAPHY_PAIRING_GUIDE = `
TYPOGRAPHY PAIRING — règles de combinaison :
  • HEADING accroche, BODY supporte. Heading doit être ≥ 2.5× plus grand que
    body. La police heading peut être expressive ; la body doit être lisible.
  • CONTRASTE FAMILLE : pair preferred = serif heading + sans body, OU sans
    expressif heading + sans neutre body. Évite serif + serif (sauf editorial
    assumé) et sans neutre + sans neutre (zéro identité).
  • SIMILARITÉ DES GLYPHES : si tu mixes 2 polices, vérifie que les lettres
    signatures (g, a, e) ont des hauteurs proches — sinon le mix paraît brisé.
  • POIDS : heading 600-900 (bold/black), body 400-500 (regular/medium).
    L'écart de poids crée la hiérarchie même quand l'échelle est proche.
  • CASSE : UPPERCASE pour heading court + tracking ≥ +0.05em, sentence case
    pour body + tracking 0. Le tout-cap body devient illisible.
  • CATÉGORIES :
    - Serif       → sophistication, tradition, éditorial (luxe, presse, légal)
    - Sans-serif  → modernité, clarté, polyvalence (tech, lifestyle, B2B)
    - Slab        → impact, headlines, presse (food, sport, retail)
    - Script      → artisanal, féminin, événement (beauté, mariage, food artisanal)
    - Display     → attention, hero ONLY (jamais pour body, jamais en bloc)
`.trim()

// ── Brand Analyst ──────────────────────────────────────────────────────────────

export interface BrandBriefInput {
  name: string
  secteur: string
  cible: string
  valeurs: string[]
  ambiance: string
  /** Unique selling proposition — the key differentiator. Optional but
   *  the strongest single quality signal for prompts that touch
   *  positioning, tagline, mood, and visual direction. */
  usp?: string
  couleurs_imposees?: string
  concurrents?: string
  references?: string
}

export function buildBrandAnalystPrompts(brief: BrandBriefInput): { system: string; user: string } {
  const system = `Tu es un Brand Strategist senior (15 ans, ex-Wolff Olins / Pentagram).
Tu auditeras des briefs marque comme un partenaire critique : tu pointes ce qui manque,
ce qui se contredit, et ce qui rendra le résultat médiocre.

Réponds UNIQUEMENT en JSON valide. Aucun markdown, aucun commentaire avant ou après.`

  // Determine which optional fields are present so the prompt can hold the
  // model accountable for using them (e.g. "tu DOIS exploiter la USP").
  const hasUsp          = !!brief.usp?.trim()
  const hasConcurrents  = !!brief.concurrents?.trim()
  const hasReferences   = !!brief.references?.trim()
  const hasImposedColor = !!brief.couleurs_imposees?.trim()

  const user = `Audit ce brief de marque comme un strategist senior. Sois exigeant — un brief médiocre = un kit médiocre.

═══════════════════════════ BRIEF ═══════════════════════════
Marque         : ${brief.name}
Secteur        : ${brief.secteur}
Cible          : ${brief.cible}
Valeurs        : ${brief.valeurs.join(', ')}
Ambiance       : ${brief.ambiance}
USP            : ${brief.usp?.trim() || '⚠️ NON RENSEIGNÉE'}
Concurrents    : ${brief.concurrents?.trim() || '— non renseignés'}
Références     : ${brief.references?.trim() || '— non renseignées'}
Couleurs       : ${brief.couleurs_imposees?.trim() || '— libres'}
═════════════════════════════════════════════════════════════

ÉVALUATION EN 3 PASSES :

1. PROFONDEUR DU BRIEF (champ brief_quality)
   • 'sufficient' = on peut générer 3 directions différenciées et défendables sans deviner.
   • 'insufficient' = au moins UN des cas suivants :
     - cible vague ("entrepreneurs", "tout le monde", "les gens")
     - valeurs génériques ("qualité, professionnel, innovant" sans secteur précis)
     - secteur trop large ("tech", "lifestyle" → demander un sous-segment)
     - ${hasUsp ? 'USP imprécise ou identique au secteur' : 'USP absente → on tombera sur du "moyen-pour-le-secteur"'}

2. CONTRADICTIONS (champ has_contradiction)
   Une vraie contradiction = deux signaux qui forceraient des chemins visuels opposés.
   Exemples canoniques :
   • "luxe" + "fun" → palette dorée sobre  vs  palette vibrant playful
   • "tech" + "naturel" → dark mode mono  vs  earth-tone organic
   • "haut de gamme" + "cible 18-25" → matières précieuses lentes  vs  drop culture rapide
   ❌ NE PAS qualifier de contradiction : "moderne + classique" (résoluble en "néo-classique"),
      "minimaliste + chaleureux" (résoluble en "warm minimalism").
   Si vraie contradiction → fournir EXACTEMENT 2 paths distincts et défendables.

3. AVERTISSEMENTS (champ suggestions)
   Liste 2-4 conseils CONCRETS pour renforcer le brief, dans cet ordre de priorité :
   ${hasUsp ? '' : 'a) "Ajoute une USP claire : qu\'est-ce qui rend %name% différent de tous les autres en %secteur% ?" '}
   ${hasConcurrents ? '' : 'b) "Liste 2-3 concurrents à éviter visuellement — ça empêche Claude de produire un look déjà-vu." '}
   ${hasReferences ? '' : 'c) "Cite 2-3 marques que tu admires (hors secteur de préférence) comme inspiration." '}
   Plus de "valeurs vagues", de cibles imprécises, etc.

DESIGN ALIGNMENT — utilise la psychologie des couleurs et formes (voir bas) pour
détecter les briefs qui mèneraient à des incohérences visuelles :
  • Si l'ambiance ('${brief.ambiance}') est incompatible avec le secteur
    typique (ex: "fun" pour un cabinet d'avocats, "luxe" pour discount),
    flag-la comme contradiction.
  • Si la cible (${brief.cible}) appelle une psychologie de couleurs/formes
    incompatible avec l'ambiance, mentionne-le dans suggestions.

SCORING (brief_score 0-100) — barème strict :
  • +25 pts si name spécifique (pas "Brand", "Test", "Mon Projet"…)
  • +20 pts si secteur ≥ 3 mots concrets (pas juste "tech" / "food")
  • +15 pts si cible ≥ 8 mots avec qualifiers (âge / persona / contexte)
  • +15 pts si valeurs ≥ 3, toutes spécifiques au secteur
  • +10 pts si USP renseignée ET différenciante${hasUsp ? '' : ' (— 10 pts ici)'}
  • +05 pts si concurrents renseignés${hasConcurrents ? '' : ' (— 5 pts ici)'}
  • +05 pts si références renseignées${hasReferences ? '' : ' (— 5 pts ici)'}
  • +05 pts si ambiance choisie cohérente avec secteur + cible
  Score < 60 → 'insufficient'. Score 60-79 → 'sufficient' avec warnings. Score ≥ 80 → 'sufficient' clean.

is_ready = (brief_score ≥ 60) && !has_contradiction.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "brief_quality": "sufficient" | "insufficient",
  "clarification_questions": ["Question 1 ?", "Question 2 ?"],
  "is_ready": true/false,
  "brief_score": 85,
  "score_breakdown": { "name": 25, "secteur": 20, "cible": 15, "valeurs": 15, "usp": 10, "concurrents": 5, "references": 5, "ambiance": 5 },
  "contradictions": ["…"],
  "has_contradiction": false,
  "contradiction_paths": [],
  "questions": ["Question 1 ?", "Question 2 ?"],
  "suggestions": ["Conseil concret 1", "Conseil concret 2"]
}

Format contradiction_paths (UNIQUEMENT si has_contradiction === true, EXACTEMENT 2 entrées) :
[
  { "label": "Path A: …", "description": "…(1-2 phrases)", "resolution": "3-5 mots-clés visuels" },
  { "label": "Path B: …", "description": "…(1-2 phrases)", "resolution": "3-5 mots-clés visuels" }
]

═══════════════════════════ RÉFÉRENCES DESIGN ═══════════════════════════
(à utiliser pour détecter les incohérences brief↔visuel attendu)

${COLOR_PSYCHOLOGY}

${SHAPE_PSYCHOLOGY}

${BRAND_ARCHITECTURE_GUIDE}`
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

export const BRAND_STRATEGY_SYSTEM = `Tu es un directeur artistique senior et brand strategist (Pentagram, Sagmeister & Walsh, ex-COLLINS).
Tu génères des identités visuelles complètes, défendables devant un comité créatif, ZÉRO cliché de secteur.

Réponds UNIQUEMENT en JSON valide. Aucun markdown, aucun commentaire avant ou après.`

// Whitelist of solid, free, multi-weight Google Fonts that pair well together.
// Used to anchor the model so it stops returning "Inter" / "Poppins" for every
// brand. Mixing display + neutral families produces real typographic identity.
const GOOGLE_FONTS_WHITELIST = {
  display_serif:    ['Playfair Display', 'Cormorant Garamond', 'Fraunces', 'DM Serif Display', 'Spectral', 'Crimson Pro', 'Lora'],
  display_sans:     ['Space Grotesk', 'Archivo', 'Big Shoulders Display', 'Bricolage Grotesque', 'Anybody', 'Unbounded', 'Familjen Grotesk'],
  display_editorial:['Instrument Serif', 'Editorial New', 'Newsreader', 'Source Serif 4', 'EB Garamond'],
  neutral_sans:     ['Inter', 'Geist', 'Manrope', 'Outfit', 'Plus Jakarta Sans', 'Sora', 'IBM Plex Sans'],
  mono:             ['JetBrains Mono', 'IBM Plex Mono', 'Geist Mono', 'Space Mono', 'Fragment Mono'],
}

export function buildBrandStrategyUserPrompt(brief: BrandBriefInput): string {
  const ambianceGuide = AMBIANCE_GUIDE[brief.ambiance] ?? brief.ambiance
  const couleursContext   = brief.couleurs_imposees?.trim() ? `\n• COULEURS IMPOSÉES : ${brief.couleurs_imposees} → CHAQUE direction DOIT intégrer ≥1 de ces HEX comme primary ou accent (jamais comme neutral / background).` : ''
  const referencesContext = brief.references?.trim()        ? `\n• RÉFÉRENCES À ADMIRER : ${brief.references} → s'inspirer du parti pris, JAMAIS copier les couleurs/typo précises.` : ''
  const concurrentsContext= brief.concurrents?.trim()       ? `\n• CONCURRENTS À ÉVITER : ${brief.concurrents} → AUCUNE direction ne doit visuellement ressembler à ces marques (palette, geste typo, mood).` : ''
  const uspContext        = brief.usp?.trim()
    ? `\n• USP — DIFFÉRENCIATEUR CLÉ : ${brief.usp} → c'est l'angle qui doit transparaître dans positioning, tagline, mood et keywords de CHAQUE direction.`
    : `\n• USP : non renseignée → infère 1 hypothèse plausible à partir de secteur+valeurs+cible, puis aligne les 3 directions autour de cette hypothèse (sans l'inventer ex-nihilo).`

  return `Génère une stratégie de marque complète, ultra-différenciée et défendable.

═══════════════════════════ BRIEF ═══════════════════════════
• MARQUE   : ${brief.name}
• SECTEUR  : ${brief.secteur}
• CIBLE    : ${brief.cible}
• VALEURS  : ${brief.valeurs.join(', ')}
• AMBIANCE : ${brief.ambiance} → ${ambianceGuide}${uspContext}${couleursContext}${referencesContext}${concurrentsContext}
═════════════════════════════════════════════════════════════

Génère EXACTEMENT 3 directions créatives + la voix de marque.

═════ STRUCTURE PAR DIRECTION (objet JSON strict) ═════
{
  "id":          "direction_1" | "direction_2" | "direction_3",
  "name":        "Nom créatif évocateur (3-5 mots, ex: 'L'Élégance Sismique')",
  "tagline":     "Slogan max 8 mots, anglais OU français selon ce qui sonne mieux",
  "positioning": "2-3 phrases qui répondent : pour QUI, contre QUOI, en faisant QUOI mieux. Cite l'USP.",
  "palette": {
    "primary":    "#HEX",   // couleur signature, lisible sur background
    "secondary":  "#HEX",   // complément à 30-60° de teinte du primary
    "accent":     "#HEX",   // pop color, contraste élevé, usage parcimonieux
    "neutral":    "#HEX",   // gris/sand/charcoal pour texte courant
    "background": "#HEX",   // fond principal (souvent très clair OU très foncé)
    "description":"1 phrase décrivant l'intention de la palette"
  },
  "typography": {
    "heading":   "Nom EXACT d'une Google Font (voir whitelist plus bas)",
    "body":      "Nom EXACT d'une Google Font (≠ heading sauf cas justifié)",
    "description":"Pourquoi cette pair fonctionne pour la marque"
  },
  "mood":       "3-4 phrases qui évoquent une scène, une matière, un son, une émotion. Pas de bullet-points, pas de jargon. Du cinéma écrit.",
  "keywords":   ["5 mots-clés visuels en français, concrets et imagés (ex: 'marbre brossé', 'lumière rasante', 'typographie tendue')"]
}

═════ VOIX DE MARQUE (objet 'voice') ═════
{
  "tone":     "Description du ton éditorial en 2 phrases — registre, niveau de langue, personnalité",
  "examples": ["3 phrases courtes ÉCRITES DANS CE TON (pas méta, des vrais exemples publishable)"],
  "dos":      ["4 choses concrètes à FAIRE dans la com (verbes d'action)"],
  "donts":    ["4 pièges précis à ÉVITER (formules, mots, postures interdites)"]
}

═══════════════════════════ RÈGLES NON-NÉGOCIABLES ═══════════════════════════

R1. DIFFÉRENCIATION DES 3 DIRECTIONS
    Les 3 directions doivent être radicalement opposables sur ≥3 axes parmi :
    palette (warm/cool/mono), typo (serif/sans/display), mood (luxe/raw/playful),
    composition (dense/aérée), époque (classique/contemporain/futur).
    ❌ Interdiction de proposer 2 variantes du même concept.

R2. PALETTE — CONTRASTE & HARMONIE (auto-check OBLIGATOIRE avant de répondre)
    a) Contraste WCAG AA : ratio (primary vs background) ≥ 4.5:1 pour le texte courant.
       Si tu ne peux PAS garantir ≥ 4.5:1, force background = '#FFFFFF' ou '#0A0A0A'.
    b) Harmonie : utilise une logique de roue chromatique
       (monochromatique / analogue / complémentaire / triadique / split-complémentaire).
       Précise dans palette.description quelle logique est utilisée.
    c) Pas de couleur "ternie sans intention" — chaque HEX a un rôle.
    d) Background ≠ neutral, sauf direction "minimalist mono" assumée.

R3. TYPOGRAPHIE — GOOGLE FONTS UNIQUEMENT, depuis la whitelist ci-dessous
    DISPLAY_SERIF    : ${GOOGLE_FONTS_WHITELIST.display_serif.join(', ')}
    DISPLAY_SANS     : ${GOOGLE_FONTS_WHITELIST.display_sans.join(', ')}
    DISPLAY_EDITORIAL: ${GOOGLE_FONTS_WHITELIST.display_editorial.join(', ')}
    NEUTRAL_SANS     : ${GOOGLE_FONTS_WHITELIST.neutral_sans.join(', ')}
    MONO             : ${GOOGLE_FONTS_WHITELIST.mono.join(', ')}
    Règles de pairing :
    • heading = display (serif/sans/editorial) ; body = neutral_sans ou mono.
    • PAS 'Inter + Inter' (zéro identité).
    • PAS 'Poppins' pour heading (overused).
    • Le pair heading+body doit refléter le mood (ex: luxe → editorial+neutral, tech → sans+mono).

R4. POSITIONING & TAGLINE
    Le positioning doit nommer la cible précise (${brief.cible}) ET pointer le différenciateur.
    La tagline n'est PAS une description ; c'est une promesse mémorable. Pas de buzzwords ('experience', 'solutions', 'unlock').

R5. CHAQUE DIRECTION REFLÈTE L'AMBIANCE "${brief.ambiance}"
    sans tomber dans le cliché. ${ambianceGuide}.
    Mais chaque direction interprète cette ambiance différemment.

R6. PRINCIPES DE DESIGN — applique ces lois à chaque direction (voir détails plus bas) :
    • Emphasis : chaque direction nomme UN point focal dominant.
    • Hiérarchie : la palette doit avoir une couleur "lead" (primary) qui domine
      sans contredire les autres ; la typographie a UN heading vs UN body
      avec contraste de poids ≥ 300 (ex: 700 vs 400).
    • Balance : précise dans palette.description si l'identité est symétrique
      (institutionnel, calme) ou asymétrique (dynamique, contemporain).
    • Unité : les 5 mots-clés visuels doivent raconter UNE histoire cohérente,
      pas être 5 attributs déconnectés.
    • Mood (composition) : précise un type de rythme dominant —
      "monumental + posé", "dense + saturé", "aéré + suspendu", etc.

R7. PSYCHOLOGIE COULEURS — la palette doit traduire l'émotion ciblée par
    secteur + valeurs. Voir la grille COLOR PSYCHOLOGY ci-dessous.
    INTERDIT : couleur qui contredit la valeur (ex : rouge "danger" pour santé,
    vert "argent" pour luxe pur). Si tu enfreins cette règle, justifie-la
    explicitement dans palette.description.

R8. PSYCHOLOGIE FORMES — keywords (et plus tard logo) doivent refléter
    une géométrie cohérente avec la cible. Voir SHAPE PSYCHOLOGY.

R9. TYPOGRAPHIE PAIR — voir TYPOGRAPHY PAIRING GUIDE pour les règles
    serif/sans/slab/script et les contrastes hauteur/poids/casse.

R10. VARIABLES VISUELLES — chaque direction nomme dans 'mood' au moins 3
     variables de Bertin qui portent la SIGNATURE de la marque (ex: "taille +
     forme + grain dominent"). C'est ce qui sépare une identité forte d'une
     identité interchangeable.

R11. SÉMIOTIQUE — précise dans positioning sur quel niveau sémiotique la marque
     mise (iconique pour lisibilité immédiate, symbolique pour capital long terme)
     et quel discours domine (fonctionnel / émotionnel / identitaire).

R12. ARCHITECTURE DE MARQUE — si l'USP suggère plusieurs produits/sous-marques
     futures, propose explicitement une architecture (monolithique / endossée /
     sub-branding) dans positioning. Ça change le logo recommandé.

═══════════════════════════ RÉFÉRENCES DESIGN ═══════════════════════════

${BRAND_DESIGN_PRINCIPLES}

${COLOR_PSYCHOLOGY}

${SHAPE_PSYCHOLOGY}

${TYPOGRAPHY_PAIRING_GUIDE}

${BERTIN_VISUAL_VARIABLES}

${BRAND_SEMIOTICS_PRINCIPLES}

${BRAND_ARCHITECTURE_GUIDE}

═════════════════════════════════════════════════════════════════════════

Réponds UNIQUEMENT avec ce JSON valide (rien avant, rien après) :
{
  "directions": [ {...direction_1...}, {...direction_2...}, {...direction_3...} ],
  "voice":      { "tone": "...", "examples": [...], "dos": [...], "donts": [...] }
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
  const system = `Tu es un directeur artistique senior spécialisé en charte graphique d'entreprise (ex-Pentagram, ex-Base Design).
Tu rédiges des chartes qu'un développeur ou un imprimeur peut appliquer sans poser de question.
Chaque champ est DIRECTEMENT actionnable (pas de "à définir", pas de "selon le contexte").

Réponds UNIQUEMENT en JSON valide. Aucun markdown, aucun commentaire, AUCUNE clé en plus de celles demandées.`

  const uspLine = brief.usp?.trim() ? `\n• USP        : ${brief.usp}` : ''

  const user = `Rédige une charte graphique COMPLÈTE et IMPLÉMENTABLE pour "${brief.name}".

═══════════════════════════ CONTEXTE ═══════════════════════════
• Marque     : ${brief.name}
• Secteur    : ${brief.secteur}
• Cible      : ${brief.cible}
• Ambiance   : ${brief.ambiance}${uspLine}

• Direction  : "${direction.name}"
• Pitch      : ${direction.positioning}

• Palette    : primary ${direction.palette.primary} · secondary ${direction.palette.secondary} · accent ${direction.palette.accent} · neutral ${direction.palette.neutral} · background ${direction.palette.background}
• Typo       : heading "${direction.typography.heading}" · body "${direction.typography.body}"
═════════════════════════════════════════════════════════════════

═══════════════════════════ RÈGLES ═══════════════════════════
R1. AUCUN champ vide ni "to be defined". Si une règle n'a pas d'évidence, propose une valeur par défaut sensée.
R2. Les unités sont CONCRÈTES : px, rem, % — jamais "petit/moyen/grand".
R3. Les couleurs sortent en HEX MAJUSCULE (#1F2A44) et RGB "31, 42, 68".
R4. Photography.style décrit ce qu'on voit ET comment c'est shooté (cadrage, lumière, post-prod).
R5. Pas de générique : "professional, modern, clean" est INTERDIT seul — relie-le au secteur + ambiance.
R6. CHAQUE règle s'aligne sur les principes de design (voir RÉFÉRENCES en bas) :
    • Le clear_space du logo respecte l'ESPACE NÉGATIF (≥ ½ hauteur du mark).
    • Les couleurs portent un nom évocateur qui reflète leur PSYCHOLOGIE
      (pas "Blue 1" mais "Bleu Crépuscule — sérénité + technologie").
    • La hiérarchie typo crée l'EMPHASE via le ratio heading/body ≥ 2.5×
      ET un contraste de poids ≥ 300 (ex: 700 vs 400).
    • Le layout.grid précise s'il est SYMÉTRIQUE (institutionnel) ou
      ASYMÉTRIQUE (dynamique) — choix conscient à justifier.
    • Photography.style applique le RYTHME (cadrage récurrent) et l'UNITÉ
      (palette de grading alignée sur palette de marque).
R7. PSYCHOLOGIE COULEURS — chaque couleur.usage cite explicitement l'émotion
    visée (voir COLOR PSYCHOLOGY ci-dessous). Si une couleur de la palette
    semble contradictoire avec les valeurs (ex: rouge urgent pour wellness),
    explique-le ou propose un override dans usage.
══════════════════════════════════════════════════════════════

═══════════════════════════ RÉFÉRENCES DESIGN ═══════════════════════════

${BRAND_DESIGN_PRINCIPLES}

${COLOR_PSYCHOLOGY}

${TYPOGRAPHY_PAIRING_GUIDE}

${BERTIN_VISUAL_VARIABLES}

${BRAND_SEMIOTICS_PRINCIPLES}

═════════════════════════════════════════════════════════════════════════

═══════════════════════════ OUTPUT JSON ═══════════════════════════
Réponds UNIQUEMENT avec cet objet (toutes les clés sont OBLIGATOIRES) :

{
  "logo_rules": {
    "clear_space":          "Distance minimale autour du logo, exprimée en multiple de la hauteur du logo (ex: '½ × hauteur du logo, soit ~24 px à taille minimale').",
    "min_size":             "Taille minimale d'affichage en px ET mm (ex: '24 px / 8 mm').",
    "allowed_backgrounds":  ["4 fonds OK, du plus safe au plus créatif — ex: 'Blanc #FFFFFF', 'Fond couleur primaire #…', 'Photo avec ≥60 % de zone sombre uniforme', 'Texture sable très claire'"],
    "forbidden":            ["4 interdits CONCRETS : '— Ne jamais déformer (stretch horizontal/vertical)', '— Pas de drop shadow ni effet 3D', '— Pas d'apposition sur photo chargée sans plaque de contraste', '— Pas de recoloration hors palette officielle'"]
  },

  "colors": [
    {
      "name":  "Nom évocateur — pas juste 'Bleu' (ex: 'Bleu Nuit', 'Ocre Soleil', 'Vert Crépuscule')",
      "hex":   "#XXXXXX",
      "rgb":   "R, G, B",
      "role":  "primary" | "secondary" | "accent" | "neutral" | "background",
      "usage": "1-2 phrases — OÙ on l'utilise (boutons, titres, fond, badge…) ET combien (%, jamais plus de X %)."
    }
    // EXACTEMENT 5 entrées, dans l'ordre primary, secondary, accent, neutral, background
  ],

  "typography": {
    "heading": {
      "font":   "${direction.typography.heading}",
      "weight": "ex: '700 Bold' ou '600 SemiBold / 800 ExtraBold'",
      "sizes":  "Échelle complète : H1 / H2 / H3 / H4 — ex: '48 px / 36 px / 28 px / 22 px'",
      "tracking": "ex: '-0.02 em (display tendu)' ou '0 em (neutre)'",
      "leading":  "ex: '1.05 (display) ou 1.15 (titre courant)'",
      "usage":  "1-2 phrases — quand utiliser cette police, quand l'éviter."
    },
    "body": {
      "font":   "${direction.typography.body}",
      "weight": "ex: '400 Regular ; 500 Medium pour emphase ; 600 SemiBold pour liens'",
      "sizes":  "ex: 'Body L 18 px / Body M 16 px / Body S 14 px'",
      "tracking": "ex: '0 em' (par défaut)",
      "leading":  "ex: '1.5 (web) / 1.4 (mobile)'",
      "usage":  "1-2 phrases — paragraphe courant, UI, navigation."
    },
    "caption": {
      "font":   "Précise une 3e police mono OU la body en petit caps (cohérent avec mood)",
      "weight": "ex: '500 Medium'",
      "sizes":  "ex: '12 px / 11 px (mobile)'",
      "tracking": "ex: '+0.08 em (open, UPPERCASE-friendly)'",
      "leading":  "ex: '1.3'",
      "usage":  "Légendes, badges, timestamps, labels formulaires."
    },
    "pairing_rationale": "1-2 phrases expliquant pourquoi heading+body fonctionnent ensemble (contraste, proportion, mood)."
  },

  "layout": {
    "grid":    "Système concret : '12 colonnes / gouttières 24 px / largeur max 1280 px (desktop), 4 colonnes 16 px (mobile)'",
    "spacing": "Unité de base ET échelle : 'base 8 px → 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96'",
    "margins": "Marges de sécurité : 'desktop 80 px latéral, mobile 20 px, vertical ≥ 48 px entre sections'",
    "radius":  "Rayons de coin : 'inputs 10 px, cards 16 px, modals 24 px, pills full'"
  },

  "photography": {
    "style":     "3 phrases CONCRÈTES — décris (a) le sujet typique (ex: 'mains au travail, matières naturelles, lumière du nord'), (b) le cadrage (close-up, plan-américain, large), (c) la post-prod (grain léger, contraste doux, désaturation rouge -10).",
    "mood":      "Émotions visées en 1 phrase + référence inspirante (ex: 'sérénité industrielle façon Wim Wenders').",
    "lighting":  "Direction et qualité de lumière (ex: 'lumière naturelle latérale, ombres marquées mais douces — éviter le flash direct').",
    "color_grading": "Recette de colorimétrie alignée sur la palette (ex: 'highlights ocre #${direction.palette.accent.slice(1)}, shadows bleutées vers ${direction.palette.primary}, mids désaturés -5').",
    "forbidden": ["4 types de photos PROSCRITES : '— stock photo générique souriant entreprise', '— fond blanc cyclo studio', '— overlay de drapeau ou citation', '— flou bokeh excessif en arrière-plan'"]
  },

  "voice_recap": {
    "tone":   "1 phrase qui reprend / affine le ton de la direction.",
    "lexicon_use":   ["3-5 mots à PRIVILÉGIER, alignés sur l'USP et la cible"],
    "lexicon_avoid": ["3-5 mots à BANNIR (jargon, buzzwords, formules creuses)"]
  }
}`
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
