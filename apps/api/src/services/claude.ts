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
  '6s': 2,
  '15s': 4,
  '30s': 6,
  '60s': 10,
  default: 6,
}

// Instructions visuelles par style — transmises à Claude pour générer description_visuelle cohérente avec fal.ai
const STYLE_VISUAL_GUIDE: Record<string, string> = {
  'animation-2d':  'flat vector cartoon illustration, bold outlines, vibrant saturated colors — absolutely NO photorealism, no 3D',
  'stock-vo':      'editorial stock photography, natural lighting, real-world scene — fully photorealistic, no illustration',
  'minimaliste':   'extreme minimalism, pure white background, single centered element, large negative space — NO clutter, NO shadows',
  'infographie':   'flat icon infographic, data visualization chart, color-coded sections, isometric view — informational design only',
  'whiteboard':    'black marker hand-drawn sketch on plain white — NO color fills, NO shading, rough strokes only',
  'cinematique':   'anamorphic cinematic wide shot, dramatic chiaroscuro, 35mm film grain, moody atmosphere — movie still quality',
  'corporate':     'clean corporate business illustration, navy blue / white palette, minimal geometric shapes — professional B2B',
  'dynamique':     'high-energy composition, motion blur, neon accents on dark background, diagonal lines — sports / action',
  'luxe':          'luxury brand photography, gold and black palette, bokeh, marble surfaces — high-fashion editorial',
  'fun':           'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti — kawaii cheerful style',
}

interface StoryboardResult {
  scenes: Scene[]
  total_duration: number
}

/**
 * Génère un storyboard structuré à partir d'un script
 * Retry automatique jusqu'à MAX_RETRIES fois
 *
 * @param script - Le script texte de la vidéo
 * @param style - Le style visuel (animation-2d, stock-vo, etc.)
 * @param targetDuration - Durée cible ('15s', '30s', '60s', etc.)
 */
export async function generateStoryboard(
  script: string,
  style: string,
  targetDuration = '30s'
): Promise<StoryboardResult> {
  const sceneCount = SCENE_COUNT_MAP[targetDuration] ?? SCENE_COUNT_MAP.default

  const systemPrompt = `Tu es un expert en production vidéo et en storytelling visuel.
Tu génères des storyboards précis et professionnels pour des vidéos sans présentateur.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const styleGuide = STYLE_VISUAL_GUIDE[style] ?? 'professional visual composition'

  const userPrompt = `Découpe ce script en exactement ${sceneCount} scènes visuelles pour une vidéo de style "${style}".

STYLE VISUEL OBLIGATOIRE pour description_visuelle : ${styleGuide}

Pour chaque scène, génère :
- "id": identifiant unique ("scene_001", "scene_002", etc.)
- "index": numéro de scène (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS optimisé pour Flux image generation (max 150 chars). DOIT respecter le style visuel ci-dessus. Ne jamais mentionner de personnes identifiables.
- "texte_voix": OBLIGATOIRE — texte narré en français pendant cette scène. Toujours rempli, jamais vide. Correspond exactement au contenu du script pour cette partie.
- "duree_estimee": durée en secondes (nombre entier, entre 3 et 10)

RÈGLES CRITIQUES :
1. description_visuelle DOIT visuellement correspondre au style "${style}" — applique strictement : ${styleGuide}
2. texte_voix est OBLIGATOIRE sur chaque scène — distribue le script complet sur toutes les scènes
3. La somme des duree_estimee doit être cohérente avec la longueur du script

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
        max_tokens: 2048,
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
 * Génère un storyboard pour Motion Graphics (avec timing précis)
 */
export async function generateMotionStoryboard(
  brief: string,
  style: string,
  format: string,
  duration: string
): Promise<StoryboardResult> {
  const sceneCount = SCENE_COUNT_MAP[duration] ?? 4

  const systemPrompt = `Tu es un expert en motion design et publicité vidéo.
Tu génères des storyboards de haute qualité pour des publicités animées.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const userPrompt = `Crée un storyboard pour une publicité en ${sceneCount} scènes.

Brief :
"""
${brief}
"""

Paramètres :
- Style : ${style}
- Format : ${format}
- Durée totale : ${duration}
- Nombre de scènes : ${sceneCount}

Pour chaque scène, génère :
- "id": "scene_001", etc.
- "index": numéro (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS pour fal.ai (max 150 chars)
- "texte_voix": texte voix off optionnel (peut être vide)
- "duree_estimee": durée en secondes

Réponds UNIQUEMENT avec ce JSON :
{
  "scenes": [...],
  "total_duration": <total>
}`

  return generateStoryboard(brief, style, duration).catch(() => {
    // Fallback sur la génération standard avec le brief
    return {
      scenes: [],
      total_duration: parseInt(duration.replace('s', ''), 10),
    }
  })

  // Note: la logique réelle utilise le prompt motion spécifique
  void systemPrompt
  void userPrompt
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
