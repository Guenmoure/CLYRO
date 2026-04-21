import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../lib/logger'
import type { Scene } from '@clyro/shared'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-6'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Nombre de scènes selon la durée cible
const SCENE_COUNT_MAP: Record<string, number> = {
  '6s':   2,
  '15s':  3,
  '30s':  4,
  '60s':  6,
  '120s': 10,
  '180s': 14,
  '300s': 20,
  'auto': 8,
  default: 4,
}

// Instructions visuelles par style — transmises à Claude pour générer description_visuelle cohérente avec fal.ai
const STYLE_VISUAL_GUIDE: Record<string, string> = {
  // Faceless — Catégorie 1 : Narratif & Immersif
  'cinematique':      'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain — movie still quality, NO illustration',
  'stock-vo':         'National Geographic style, natural light, realistic textures, real-world documentary scene — fully photorealistic, no illustration, no cartoon',
  // Faceless — Catégorie 2 : Explicatif & Didactique (PDF 4-style canonical)
  'whiteboard':       'hand-drawn sketch on whiteboard, black marker on plain white — NO color fills, NO shading, rough strokes only, RSA Animate educational style',
  'stickman':         'black stick figures and geometric shapes on white background, RSA animate bonhommes style — NO fills, NO gradients, bold expressive line drawing, symbolic minimal storytelling',
  'minimaliste':      'simple black line art on white background, minimalist stickman/stick-figure illustration — NO fills, NO gradients, ultra clean linework only',
  'flat-design':      'flat vector illustration, bold solid colors, no shadows, no gradients, Dribbble-quality SVG aesthetic — modern digital design, geometric shapes, vibrant palette',
  'infographie':      'flat icon infographic, animated data visualization chart, color-coded sections, isometric perspective — informational design, professional B2B',
  '3d-pixar':         'Pixar-style 3D CGI render, claymation texture, rounded adorable characters, soft studio lighting, rich vibrant colors — Disney Pixar movie quality, no photorealism',
  // Faceless — Catégorie 3 : Design & Rythme
  'motion-graphics':  'flat design motion graphics, geometric shapes, vibrant vector colors, bold animated typography, kinetic composition — tech brand, high-end ad quality',
  'animation-2d':     'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors — absolutely NO photorealism, no 3D, traditional animation frame',
  // Motion styles
  'corporate':        'clean corporate business illustration, navy blue / white palette, minimal geometric shapes — professional B2B',
  'dynamique':        'high-energy composition, motion blur, neon accents on dark background, diagonal lines — sports / action',
  'luxe':             'luxury brand photography, gold and black palette, bokeh, marble surfaces — high-fashion editorial',
  'fun':              'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti — kawaii cheerful style',
}

interface StoryboardResult {
  scenes: Scene[]
  total_duration: number
  master_seed?: number
}

/**
 * Génère un seed déterministe basé sur le script pour character consistency
 * Même script = même seed = même apparence de personnages entre scènes (PDF cref pattern)
 */
export function generateMasterSeed(script: string): number {
  let hash = 0
  for (let i = 0; i < script.length; i++) {
    const char = script.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Ensure positive seed in valid fal.ai range
  return Math.abs(hash) % 2_147_483_647
}

/**
 * Détecte les dialogues dans le script et retourne les noms des personnages détectés
 * Patterns reconnus: "Name:", "— Name", guillemets
 */
export function detectDialoguePatterns(script: string): { hasDialogue: boolean; speakers: Set<string> } {
  const lines = script.split('\n')
  const speakers = new Set<string>()

  const patterns = [
    /^—\s*([A-ZÀ-Ü][a-zà-ü]+)/,           // — Alice
    /^([A-ZÀ-Ü][a-zà-ü]+)\s*:/,           // Alice:
    /^–\s*([A-ZÀ-Ü][a-zà-ü]+)/,           // – Alice
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        speakers.add(match[1])
      }
    }
  }

  return {
    hasDialogue: speakers.size > 1,
    speakers,
  }
}

/**
 * Crée un mapping speaker → voice_id en alternant entre 2 voix par défaut
 * Utile pour le dialogue auto-detection
 */
export function assignAlternatingVoices(
  speakers: Set<string>,
  defaultVoices: [string, string] = [
    process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? 'Adam',      // Voice 1
    'Charlotte',                                              // Voice 2
  ]
): Record<string, string> {
  const voiceMap: Record<string, string> = {}
  const speakerList = Array.from(speakers).sort()

  for (let i = 0; i < speakerList.length; i++) {
    voiceMap[speakerList[i]] = defaultVoices[i % 2]
  }

  return voiceMap
}

/**
 * Génère un storyboard structuré à partir d'un script
 * Retry automatique jusqu'à MAX_RETRIES fois
 *
 * @param script - Le script texte de la vidéo
 * @param style - Le style visuel (animation-2d, stock-vo, etc.)
 * @param targetDuration - Durée cible ('15s', '30s', '60s', etc.)
 */
export interface BrandKitContext {
  name: string
  primary_color: string
  secondary_color?: string | null
  font_family?: string | null
}

export async function generateStoryboard(
  script: string,
  style: string,
  targetDuration = '30s',
  brandKit?: BrandKitContext
): Promise<StoryboardResult> {
  const sceneCount = SCENE_COUNT_MAP[targetDuration] ?? SCENE_COUNT_MAP.default
  const masterSeed = generateMasterSeed(script)

  const systemPrompt = `Tu es un expert en production vidéo et en storytelling visuel.
Tu génères des storyboards précis et professionnels pour des vidéos sans présentateur.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const styleGuide = STYLE_VISUAL_GUIDE[style] ?? 'professional visual composition'

  // Injection Brand Kit dans le contexte visuel
  const brandContext = brandKit
    ? `\nBRAND KIT "${brandKit.name}" : utilise la palette de couleurs ${brandKit.primary_color}${brandKit.secondary_color ? ` / ${brandKit.secondary_color}` : ''} dans les descriptions visuelles quand pertinent.`
    : ''

  const userPrompt = `Découpe ce script en exactement ${sceneCount} scènes visuelles pour une vidéo de style "${style}".

STYLE VISUEL OBLIGATOIRE pour description_visuelle : ${styleGuide}${brandContext}

Pour chaque scène, génère :
- "id": identifiant unique ("scene_001", "scene_002", etc.)
- "index": numéro de scène (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS optimisé pour Flux image generation (max 150 chars). DOIT respecter le style visuel ci-dessus. Ne jamais mentionner de personnes identifiables.
- "animation_prompt": prompt de mouvement en ANGLAIS pour image-to-video (max 80 chars). Décrit le mouvement de caméra et l'action visible : ex "slow zoom in, character gestures forward, subtle breathing motion", "camera pans left, gentle wind effect, dynamic energy".
- "texte_voix": OBLIGATOIRE — texte narré en français pendant cette scène. Toujours rempli, jamais vide. Correspond exactement au contenu du script pour cette partie.
- "duree_estimee": durée en secondes (nombre entier, entre 3 et 10)

RÈGLES CRITIQUES :
1. description_visuelle DOIT visuellement correspondre au style "${style}" — applique strictement : ${styleGuide}
2. animation_prompt DOIT décrire un mouvement concret visible dans la scène (jamais générique)
3. texte_voix est OBLIGATOIRE sur chaque scène — distribue le script complet sur toutes les scènes
4. La somme des duree_estimee doit être cohérente avec la longueur du script

Script :
"""
${script}
"""

Réponds UNIQUEMENT avec ce JSON valide :
{
  "scenes": [...],
  "total_duration": <somme des durées>
}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()

      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      })

      const duration = Date.now() - startTime
      const inputTokens = message.usage.input_tokens
      const outputTokens = message.usage.output_tokens

      logger.info(
        { model: MODEL, inputTokens, outputTokens, duration, attempt },
        'Claude storyboard generated'
      )

      const content = message.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      // Parser le JSON — nettoyer les éventuels backticks markdown
      const jsonText = content.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const result = JSON.parse(jsonText) as StoryboardResult

      if (!result.scenes || !Array.isArray(result.scenes)) {
        throw new Error('Invalid storyboard response: missing scenes array')
      }

      result.master_seed = masterSeed
      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, error: lastError.message },
        'Claude storyboard attempt failed, retrying'
      )

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt)
      }
    }
  }

  logger.error({ error: lastError }, 'Claude storyboard generation failed after all retries')
  throw new Error(`Storyboard generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

/**
 * Génère un storyboard optimisé pour Motion Graphics / publicités animées
 * Utilise un prompt spécialisé publicité (différent du storyboard Faceless)
 */
export async function generateMotionStoryboard(
  brief: string,
  style: string,
  format: string,
  duration: string,
  /** Optional voiceover script. When provided + duration='auto' the scene count
   *  is derived from its word count so the full script is preserved. */
  script?: string,
): Promise<StoryboardResult> {
  const isAuto = duration === 'auto'
  let sceneCount = SCENE_COUNT_MAP[duration] ?? 4
  let estimatedSeconds: number | null = null
  if (isAuto && script && script.trim()) {
    const words = script.trim().split(/\s+/).filter(Boolean).length
    estimatedSeconds = Math.max(6, Math.round((words / 150) * 60))
    sceneCount = Math.max(3, Math.min(40, Math.ceil(words / 22)))
  }
  const styleGuide = STYLE_VISUAL_GUIDE[style] ?? 'professional motion design, clean vector art'

  const systemPrompt = `Tu es un expert en motion design et publicité vidéo animée.
Tu génères des storyboards de haute qualité pour des spots publicitaires.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const durationLine = isAuto
    ? `- Durée totale : AUTO — s'adapte à la longueur réelle du script/brief (${estimatedSeconds ? `~${estimatedSeconds}s estimé` : 'calculée naturellement'}). Ne condense PAS, ne tronque PAS.`
    : `- Durée totale : ${duration} — la somme des duree_estimee doit correspondre à cette cible, jamais la dépasser.`

  const userPrompt = `Crée un storyboard publicitaire en ${isAuto ? `environ ${sceneCount}` : `exactement ${sceneCount}`} scènes visuelles.

Brief client :
"""
${brief}
"""
${script && script.trim() ? `\nSCRIPT VOIX OFF À PRÉSERVER INTÉGRALEMENT :\n"""\n${script.trim()}\n"""\n→ Distribue ce script sur toutes les scènes via texte_voix, sans rien omettre.` : ''}
Paramètres :
- Style visuel : ${style} — ${styleGuide}
- Format : ${format}
${durationLine}

Pour chaque scène, génère :
- "id": "scene_001", "scene_002", etc.
- "index": numéro de scène (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS optimisé pour Flux image generation (max 150 chars). Doit respecter STRICTEMENT le style "${style}" : ${styleGuide}. Aucune personne identifiable. VIDE ("") si needs_background est false.
- "display_text": texte court et percutant en français affiché à l'écran (max 8 mots). Différent de texte_voix. OBLIGATOIRE sur chaque scène.
- "texte_voix": voix off publicitaire en français (peut être vide si scène visuelle sans narration)
- "duree_estimee": durée en secondes (entre 2 et 8)
- "animation_type": type d'animation Remotion — choisir parmi : "slide-in" (texte glisse depuis le bas), "zoom" (zoom dramatique image+texte), "fade" (fondu doux), "particle-burst" (explosion de particules colorées), "typewriter" (texte s'écrit caractère par caractère). Varié, jamais le même 2 fois consécutivement.
- "scene_type": type de scène Remotion — choisir parmi : "text_hero" (typographie plein écran, pas d'image), "split_text_image" (texte gauche, image droite), "product_showcase" (image produit centrée, logo + CTA), "stats_counter" (chiffre animé, display_text = la valeur ex: "87%"), "cta_end" (UNIQUEMENT sur la DERNIÈRE scène, appel à l'action final), "image_full" (image plein cadre avec texte overlay — style narratif/cinématique)
- "needs_background": true si la scène nécessite une image générée par IA (scène narrative/visuelle), false si c'est une scène typographique pure (titre, statistique, CTA)
- "cta_text": texte du bouton call-to-action UNIQUEMENT sur la dernière scène (ex: "Essayez gratuitement"), null pour toutes les autres

RÈGLES PUBLICITÉ :
1. Structure narrative : Accroche → Problème → Solution → Bénéfice → Call to action
2. Chaque scène doit avoir un impact visuel fort et immédiat
3. La description_visuelle DOIT coller au style "${style}" — vide si needs_background est false
4. La DERNIÈRE scène : needs_background: false, animation_type: "slide-in", scene_type: "cta_end", display_text: message CTA fort
5. Varie les animation_type sur l'ensemble des scènes
6. display_text = accroche principale visible à l'écran, courte et punchy
7. RÈGLES scene_type : Première scène → souvent "text_hero" pour accrocher. Scènes narratives → "image_full". Scènes chiffrées → "stats_counter" (display_text = la valeur chiffrée ex: "87%"). Produit mis en avant → "product_showcase". Explication visuelle → "split_text_image". DERNIÈRE scène → toujours "cta_end" avec needs_background: false.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "scenes": [...],
  "total_duration": <somme des durées>
}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()

      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      })

      const durationMs = Date.now() - startTime
      logger.info(
        { model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, durationMs, attempt },
        'Claude motion storyboard generated'
      )

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

      const jsonText = content.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const result = JSON.parse(jsonText) as StoryboardResult

      if (!result.scenes || !Array.isArray(result.scenes)) {
        throw new Error('Invalid storyboard response: missing scenes array')
      }

      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, maxRetries: MAX_RETRIES, error: lastError.message }, 'Claude motion storyboard attempt failed, retrying')

      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  logger.error({ error: lastError }, 'Claude motion storyboard failed after all retries')
  throw new Error(`Motion storyboard generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

/**
 * Génère une séquence de MotionScene[] (F2 Motion Design) à partir d'un brief.
 * Chaque scène utilise le système de types discriminants (hero_typo, 3d_cards, etc.)
 * défini dans @clyro/video.
 */
export interface MotionDesignResult {
  scenes: import('@clyro/video').MotionScene[]
  voiceoverScript: string   // texte consolidé pour ElevenLabs
  totalFrames: number        // somme des durées en frames (30 fps)
}

export async function generateMotionDesignScenes(
  brief: string,
  format: string,
  duration: string,
  brandConfig: { primary_color: string; secondary_color?: string; logo_url?: string },
): Promise<MotionDesignResult> {
  const FPS = 30

  // Nombre de scènes cible selon durée
  const durationMap: Record<string, number> = {
    '6s': 2, '15s': 3, '30s': 5, '60s': 8, '90s': 10, '120s': 12, '180s': 16, '300s': 22, 'auto': 6,
  }
  const sceneCount = durationMap[duration] ?? 6

  const systemPrompt = `Tu es Motion Design Director chez une agence de haut niveau (Pentagram, Buck, ManvsMachine).
Tu génères des scripts de vidéos en Motion Design de qualité agency pour des marques premium.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const color = brandConfig.primary_color
  const logoUrl = brandConfig.logo_url ?? null

  const userPrompt = `Crée une séquence F2 Motion Design de ${sceneCount} scènes pour ce brief :

"""
${brief}
"""

Format vidéo : ${format}
Durée cible : ${duration}
Couleur de marque : ${color}
${logoUrl ? `Logo disponible : ${logoUrl}` : ''}

Chaque scène est un objet JSON avec ces champs :
- "id": string unique ("scene_001", "scene_002", …)
- "type": l'un des types de scène ci-dessous
- "duration": durée en frames (30 fps) — entre 60 (2s) et 210 (7s)
- "props": objet de props selon le type (voir types ci-dessous)
- "voiceover": texte narré en français pendant cette scène (peut être "")

TYPES DE SCÈNES DISPONIBLES :

1. hero_typo — Typographie plein écran cinématique
   props: { type: "hero_typo", text: string, subtext?: string, mode: "dark"|"light", animation: "word_by_word"|"line_by_line"|"scale_bounce"|"split_reveal"|"3d_rotate", color: "${color}", fontSize?: number }

2. 3d_cards — Grille de cartes sociales 3D flottantes
   props: { type: "3d_cards", cards: [{name: string, content: string, metrics?: {likes?: number, comments?: number}, platform?: "instagram"|"linkedin"|"tiktok"|"twitter"}], headline: string, mode: "dark"|"light", layout?: "scatter"|"v_shape"|"tunnel"|"orbit" }

3. stats_counter — Compteurs animés de statistiques
   props: { type: "stats_counter", stats: [{value: number, unit: string, label: string, color: "${color}"}], headline?: string, mode: "dark"|"light" }

4. floating_icons — Icônes flottantes en cercle avec avatar central
   props: { type: "floating_icons", icons: [{emoji: string, label: string, color: string}], headline: string, mode: "dark"|"light" }

5. dark_light_switch — Transition dramatique dark/light
   props: { type: "dark_light_switch", direction: "dark_to_light"|"light_to_dark", style?: "flash"|"wipe"|"circle_reveal" }

6. logo_reveal — Reveal cinématique du logo
   props: { type: "logo_reveal", logoUrl: "${logoUrl ?? color}", tagline?: string, brandColor: "${color}", style?: "assemble"|"scale_bounce"|"particles_in", mode: "dark"|"light" }

RÈGLES :
1. Commence toujours par hero_typo (accroche forte)
2. Termine toujours par logo_reveal ou hero_typo (CTA)
3. Varie les types — jamais deux hero_typo consécutifs
4. mode "dark" pour scènes dramatiques/premium, "light" pour scènes claires/produit
5. Les stats_counter doivent avoir des chiffres réels et pertinents pour le brief
6. voiceover distribue la narration sur les scènes clés (peut être vide sur dark_light_switch)

Réponds UNIQUEMENT avec ce JSON valide :
{
  "scenes": [
    { "id": "scene_001", "type": "hero_typo", "duration": 90, "props": {...}, "voiceover": "..." },
    ...
  ]
}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 6000,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      })

      logger.info(
        { model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, durationMs: Date.now() - startTime, attempt },
        'Claude motion design scenes generated'
      )

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

      const jsonText = content.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const parsed = JSON.parse(jsonText) as { scenes: Array<{ id: string; type: string; duration: number; props: object; voiceover?: string }> }

      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        throw new Error('Invalid response: missing scenes array')
      }

      // Build voiceover script from all non-empty voiceover fields
      const voiceoverScript = parsed.scenes
        .map((s) => s.voiceover ?? '')
        .filter((v) => v.trim().length > 0)
        .join(' ')

      // Convert to MotionScene[] (strip voiceover from final props — it's separate)
      const scenes = parsed.scenes.map((s) => ({
        id:       s.id,
        type:     s.type as import('@clyro/video').MotionSceneType,
        duration: Math.max(30, s.duration),
        props:    s.props as import('@clyro/video').MotionSceneProps,
      }))

      const totalFrames = scenes.reduce((sum, s) => sum + s.duration, 0)

      return { scenes, voiceoverScript, totalFrames }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, maxRetries: MAX_RETRIES, error: lastError.message }, 'Claude motion design attempt failed, retrying')
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(`Motion design scene generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── WPM / Script duration check ────────────────────────────────────────────────

/** Vitesse de parole française naturelle (voix off pro) */
const WPM_FR = 150

/** Durée cible en secondes par identifiant */
const DURATION_SECONDS: Record<string, number> = {
  '6s': 6, '15s': 15, '30s': 30, '60s': 60,
  '120s': 120, '180s': 180, '300s': 300, 'auto': 120,
}

export interface WpmCheckResult {
  ok: boolean
  wordCount: number
  estimatedSeconds: number
  targetSeconds: number
  overflowPct: number  // négatif = sous la cible, positif = dépassement
}

/**
 * Calcule le dépassement WPM d'un script par rapport à une durée cible.
 * Basé sur 150 mots/min (voix off française professionnelle).
 */
export function checkScriptWpm(script: string, targetDuration: string): WpmCheckResult {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = (wordCount / WPM_FR) * 60
  const targetSeconds = DURATION_SECONDS[targetDuration] ?? 30
  const overflowPct = ((estimatedSeconds - targetSeconds) / targetSeconds) * 100

  return {
    ok: overflowPct <= 20,
    wordCount,
    estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
    targetSeconds,
    overflowPct: Math.round(overflowPct * 10) / 10,
  }
}

export interface CondenseResult {
  condensedScript: string
  originalWordCount: number
  condensedWordCount: number
}

/**
 * Condense un script trop long via Claude pour tenir dans la durée cible.
 * Préserve les messages clés, réduit le volume de mots.
 */
export async function condenseScript(
  script: string,
  targetDuration: string,
): Promise<CondenseResult> {
  const targetSeconds = DURATION_SECONDS[targetDuration] ?? 30
  const maxWords = Math.floor((targetSeconds / 60) * WPM_FR)
  const originalWordCount = script.trim().split(/\s+/).filter(Boolean).length

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'Tu es un copywriter expert. Tu condenses des scripts vidéo en préservant les messages clés. Tu réponds UNIQUEMENT avec le script condensé, sans explication, sans guillemets, sans markdown.',
    messages: [{
      role: 'user',
      content: `Condense ce script de voix off en MAXIMUM ${maxWords} mots (durée cible : ${targetSeconds}s à 150 mots/min).
Préserve : le message principal, le CTA, le ton. Supprime : répétitions, formulations longues, détails secondaires.

Script original (${originalWordCount} mots) :
"""
${script}
"""

Réponds uniquement avec le script condensé.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response from Claude condense')

  const condensedScript = content.text.trim()
  const condensedWordCount = condensedScript.split(/\s+/).filter(Boolean).length

  logger.info(
    { originalWordCount, condensedWordCount, targetSeconds, maxWords },
    'Script condensed by Claude'
  )

  return { condensedScript, originalWordCount, condensedWordCount }
}
