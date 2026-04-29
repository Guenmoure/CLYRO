import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../lib/logger'
import type { Scene } from '@clyro/shared'
import type { DetectedLanguage } from '../lib/detect-language'

// Helper used by every prompt: inject an unambiguous "output language"
// header at the very top of the user prompt. Empirically, when the rest
// of the prompt is heavily seeded with French (style guides, examples,
// system message), Claude was mirroring that language even with explicit
// "do not translate" instructions. Stating the target language as the
// FIRST thing in CAPS in the prompt body breaks the bias.
function languageHeader(lang: DetectedLanguage): string {
  return `OUTPUT LANGUAGE — STRICT
All narration text and on-screen copy fields (texte_voix, voiceover, display_text, headline, subtext, label, tagline, cta_text, etc.) MUST be written in ${lang.name} (${lang.code}).
This is non-negotiable. Do NOT translate to French, English, or any other language regardless of the language used in the rest of these instructions. The visual prompt fields (description_visuelle, animation_prompt) remain in English because downstream image/video models only understand English.

`
}

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
//
// Règle d'or : styles routés sur flux/schnell (cinematique, stock-vo, 3d-pixar,
// animation-2d, flat-design, stickman, corporate, luxe, fun, dynamique) ne DOIVENT
// JAMAIS demander de texte/chiffres/labels lisibles — schnell les rend illisibles.
// Seuls infographie / motion-graphics / whiteboard routent sur Ideogram v2 qui
// sait réellement écrire du texte, donc ces trois styles peuvent inclure des labels.
const STYLE_VISUAL_GUIDE: Record<string, string> = {
  // Faceless — Catégorie 1 : Narratif & Immersif  (schnell)
  'cinematique':      'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain — movie still quality, NO illustration, NO visible text or letters in frame',
  'stock-vo':         'National Geographic style, natural light, realistic textures, real-world documentary scene — fully photorealistic, no illustration, no cartoon, NO signs or readable text in frame',
  // Faceless — Catégorie 2 : Explicatif & Didactique
  // whiteboard → Ideogram v2 (text-heavy): can include handwritten annotations, arrows, callouts
  'whiteboard':       'hand-drawn sketch on whiteboard, black marker on plain white — NO color fills, NO shading, rough strokes only, RSA Animate educational style — handwritten single-word labels and arrows are OK (rendered via Ideogram)',
  // stickman / minimaliste / flat-design → schnell: NO text
  'stickman':         'black stick figures and geometric shapes on white background, RSA animate bonhommes style — NO fills, NO gradients, NO text, bold expressive line drawing, symbolic minimal storytelling',
  'minimaliste':      'simple black line art on white background, minimalist stickman/stick-figure illustration — NO fills, NO gradients, NO text or labels, ultra clean linework only',
  'flat-design':      'flat vector illustration, bold solid colors, no shadows, no gradients, Dribbble-quality SVG aesthetic — modern digital design, geometric shapes, vibrant palette, NO visible text or readable labels',
  // infographie → Ideogram v2: can include readable percentages, labels, axis text
  'infographie':      'flat icon infographic, data visualization chart with simple bar/donut/line graph, color-coded sections, isometric perspective — professional B2B editorial design, readable axis labels and short percentage callouts are OK (rendered via Ideogram)',
  // 3d-pixar, animation-2d → schnell: NO text
  '3d-pixar':         'Pixar-style 3D CGI render, claymation texture, rounded adorable characters, soft studio lighting, rich vibrant colors — Disney Pixar movie quality, no photorealism, NO visible text in frame',
  'animation-2d':     'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors — absolutely NO photorealism, no 3D, NO readable text, traditional animation frame',
  // motion-graphics → Ideogram v2: can include bold animated typography
  'motion-graphics':  'flat design motion graphics, geometric shapes, vibrant vector colors, kinetic composition — tech brand, high-end ad quality, bold typographic headline (1-3 words max, rendered via Ideogram)',
  // Motion styles — all schnell
  'corporate':        'clean corporate business illustration, navy blue / white palette, minimal geometric shapes — professional B2B, NO visible text in frame',
  'dynamique':        'high-energy composition, motion blur, neon accents on dark background, diagonal lines — sports / action, NO readable text',
  'luxe':             'luxury brand photography, gold and black palette, bokeh, marble surfaces — high-fashion editorial, NO visible text or typography',
  'fun':              'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti — kawaii cheerful style, NO visible text',
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
  brandKit?: BrandKitContext,
  language?: DetectedLanguage,
): Promise<StoryboardResult> {
  const sceneCount = SCENE_COUNT_MAP[targetDuration] ?? SCENE_COUNT_MAP.default
  const masterSeed = generateMasterSeed(script)
  const lang: DetectedLanguage = language ?? { code: 'en', name: 'English', nativeName: 'English' }

  const systemPrompt = `You are an expert video producer and visual storyteller.
You generate precise, professional storyboards for faceless videos (no on-camera presenter).

CRITICAL RULE — Text inside the image:
Diffusion models (Flux, Ideogram) cannot reliably render readable text in images.
→ Specific numbers, stats, titles, quotes and CTAs are ALWAYS rendered in post-production
  as drawtext overlays. Put them in the "overlay" field, NEVER in "description_visuelle".
→ "description_visuelle" only describes the visual background (setting, characters, mood,
  abstract shapes). If a scene expresses data, describe the SILENT chart
  (e.g. "bar chart silhouette, three rising bars") — not the digits themselves.

You reply ONLY with valid JSON, no markdown, no comments.`

  const styleGuide = STYLE_VISUAL_GUIDE[style] ?? 'professional visual composition'

  // Brand Kit injection into the visual context.
  const brandContext = brandKit
    ? `\nBRAND KIT "${brandKit.name}": use the color palette ${brandKit.primary_color}${brandKit.secondary_color ? ` / ${brandKit.secondary_color}` : ''} in the visual descriptions when relevant.`
    : ''

  const userPrompt = `${languageHeader(lang)}Break this script into exactly ${sceneCount} visual scenes for a "${style}" style video.

REQUIRED VISUAL STYLE for description_visuelle: ${styleGuide}${brandContext}

For each scene, produce:
- "id": unique identifier ("scene_001", "scene_002", …)
- "index": scene number (starts at 0)
- "description_visuelle": visual prompt in ENGLISH optimised for Flux image generation (max 150 chars). MUST follow the visual style above. Never mention identifiable real people. Never request readable numbers/stats/titles/quotes in the image — those go in "overlay".
- "animation_prompt": motion prompt in ENGLISH for image-to-video (max 80 chars). Describes camera movement and visible action, e.g. "slow zoom in, character gestures forward, subtle breathing motion", "camera pans left, gentle wind effect, dynamic energy".
- "texte_voix": REQUIRED — narration text written in ${lang.name} (the script's language). NEVER translate. Always filled, never empty. Matches exactly the part of the script this scene covers.
- "duree_estimee": duration in seconds (integer, between 3 and 10)
- "overlay" (OPTIONAL): object { "type": "stat" | "title" | "quote" | "cta", "text": "…", "position": "top-center" | "center" | "bottom-center" | … }
  → Only fill this when texte_voix contains a specific number, a striking stat, a punchy title,
    a quote, or a closing CTA. Example pattern (the texts below MUST follow ${lang.name}, the
    examples are illustrative):
      texte_voix containing "87% of small businesses fail" → overlay: { type: "stat", text: "87%", position: "center" }
      texte_voix introducing rule #1 → overlay: { type: "title", text: "Rule #1", position: "top-center" }
      closing CTA → overlay: { type: "cta", text: "Subscribe", position: "bottom-center" }
  → "text" must stay in ${lang.name}. Max 30 characters. Absent if the scene has no memorable beat.

CRITICAL RULES:
1. LANGUAGE: every "texte_voix" and every "overlay.text" MUST be written in ${lang.name}. Never translate the script. "description_visuelle" and "animation_prompt" stay in English (Flux/Kling consume them).
2. description_visuelle MUST visually match the "${style}" style — strictly apply: ${styleGuide}
3. animation_prompt MUST describe a concrete movement visible in the scene (never generic).
4. texte_voix is REQUIRED on every scene — distribute the full script across all scenes WITHOUT translating it.
5. Sum of duree_estimee must be consistent with the script's length.
6. Numbers, stats, titles, CTAs → "overlay" field ONLY, never inside "description_visuelle".

Script (treat as ${lang.name} content — preserve verbatim across texte_voix fields):
"""
${script}
"""

Reply ONLY with this valid JSON:
{
  "scenes": [...],
  "total_duration": <sum of durations>
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
  language?: DetectedLanguage,
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
  const lang: DetectedLanguage = language ?? { code: 'en', name: 'English', nativeName: 'English' }

  const systemPrompt = `You are an expert in motion design and animated video advertising.
You generate high-quality storyboards for ad spots.
You reply ONLY with valid JSON, no markdown, no comments.`

  const durationLine = isAuto
    ? `- Total duration: AUTO — adapts to the actual script/brief length (${estimatedSeconds ? `~${estimatedSeconds}s estimated` : 'computed naturally'}). Do NOT condense, do NOT truncate.`
    : `- Total duration: ${duration} — the sum of duree_estimee must match this target and never exceed it.`

  const userPrompt = `${languageHeader(lang)}Build an ad storyboard with ${isAuto ? `about ${sceneCount}` : `exactly ${sceneCount}`} visual scenes.

Client brief:
"""
${brief}
"""
${script && script.trim() ? `\nVOICEOVER SCRIPT TO PRESERVE VERBATIM (treat as ${lang.name} content):\n"""\n${script.trim()}\n"""\n→ Distribute this script across all scenes via texte_voix, omit nothing.` : ''}
Parameters:
- Visual style: ${style} — ${styleGuide}
- Format: ${format}
${durationLine}

For each scene, produce:
- "id": "scene_001", "scene_002", …
- "index": scene number (starts at 0)
- "description_visuelle": visual prompt in ENGLISH optimised for Flux image generation (max 150 chars). Must STRICTLY follow the "${style}" style: ${styleGuide}. No identifiable real people. EMPTY ("") if needs_background is false.
- "display_text": short, punchy on-screen text in ${lang.name} (max 8 words). Different from texte_voix. REQUIRED on every scene. NEVER translate.
- "texte_voix": ad voice-over in ${lang.name} (may be empty if it's a pure visual scene without narration). NEVER translate.
- "duree_estimee": duration in seconds (between 2 and 8)
- "animation_type": Remotion animation type — pick from "slide-in" (text slides up from bottom), "zoom" (dramatic zoom on image+text), "fade" (gentle dissolve), "particle-burst" (colourful particle explosion), "typewriter" (character-by-character typing). Vary it; never repeat the same one twice in a row.
- "scene_type": Remotion scene type — pick from "text_hero" (full-screen typography, no image), "split_text_image" (text left, image right), "product_showcase" (centred product image, logo + CTA), "stats_counter" (animated number, display_text = the value e.g. "87%"), "cta_end" (ONLY on the LAST scene, final call to action), "image_full" (full-frame image with text overlay — narrative/cinematic).
- "needs_background": true if the scene needs an AI-generated image (narrative/visual scene), false if it's pure typography (title, stat, CTA).
- "cta_text": call-to-action button text in ${lang.name}, ONLY on the last scene; null on all others.

AD RULES:
1. LANGUAGE: display_text, texte_voix, and cta_text MUST be in ${lang.name}. NEVER translate. description_visuelle stays in English (Flux consumes it).
2. Narrative structure: Hook → Problem → Solution → Benefit → Call to action.
3. Every scene must have a strong, immediate visual impact.
4. description_visuelle MUST match the "${style}" style — empty if needs_background is false.
5. LAST scene: needs_background: false, animation_type: "slide-in", scene_type: "cta_end", display_text: a strong CTA message in ${lang.name}.
6. Vary animation_type across scenes.
7. display_text = the main on-screen hook, short and punchy, in ${lang.name}.
8. scene_type RULES: first scene → often "text_hero" to hook. Narrative scenes → "image_full". Number-driven scenes → "stats_counter" (display_text = the figure e.g. "87%"). Featured product → "product_showcase". Visual explanation → "split_text_image". LAST scene → always "cta_end" with needs_background: false.

Reply ONLY with this valid JSON:
{
  "scenes": [...],
  "total_duration": <sum of durations>
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
  language?: DetectedLanguage,
): Promise<MotionDesignResult> {
  const FPS = 30

  // Target scene count by duration.
  const durationMap: Record<string, number> = {
    '6s': 2, '15s': 3, '30s': 5, '60s': 8, '90s': 10, '120s': 12, '180s': 16, '300s': 22, 'auto': 6,
  }
  const sceneCount = durationMap[duration] ?? 6
  const lang: DetectedLanguage = language ?? { code: 'en', name: 'English', nativeName: 'English' }

  const systemPrompt = `You are Motion Design Director at a top-tier agency (Pentagram, Buck, ManvsMachine).
You generate agency-quality motion design video scripts for premium brands.
You reply ONLY with valid JSON, no markdown, no comments.`

  const color = brandConfig.primary_color
  const logoUrl = brandConfig.logo_url ?? null

  const userPrompt = `${languageHeader(lang)}Create an F2 Motion Design sequence of ${sceneCount} scenes for this brief:

"""
${brief}
"""

Video format: ${format}
Target duration: ${duration}
Brand color: ${color}
${logoUrl ? `Logo available: ${logoUrl}` : ''}

Each scene is a JSON object with these fields:
- "id": unique string ("scene_001", "scene_002", …)
- "type": one of the scene types below
- "duration": duration in frames (30 fps) — between 60 (2s) and 210 (7s)
- "props": props object matching the type (see types below)
- "voiceover": narration text in ${lang.name} (NEVER translate; may be "" on scenes without narration)

AVAILABLE SCENE TYPES:

1. hero_typo — full-screen cinematic typography
   props: { type: "hero_typo", text: string, subtext?: string, mode: "dark"|"light", animation: "word_by_word"|"line_by_line"|"scale_bounce"|"split_reveal"|"3d_rotate", color: "${color}", fontSize?: number }

2. 3d_cards — floating 3D social cards grid
   props: { type: "3d_cards", cards: [{name: string, content: string, metrics?: {likes?: number, comments?: number}, platform?: "instagram"|"linkedin"|"tiktok"|"twitter"}], headline: string, mode: "dark"|"light", layout?: "scatter"|"v_shape"|"tunnel"|"orbit" }

3. stats_counter — animated stat counters
   props: { type: "stats_counter", stats: [{value: number, unit: string, label: string, color: "${color}"}], headline?: string, mode: "dark"|"light" }

4. floating_icons — floating icons in a circle around a central avatar
   props: { type: "floating_icons", icons: [{emoji: string, label: string, color: string}], headline: string, mode: "dark"|"light" }

5. dark_light_switch — dramatic dark/light transition
   props: { type: "dark_light_switch", direction: "dark_to_light"|"light_to_dark", style?: "flash"|"wipe"|"circle_reveal" }

6. logo_reveal — cinematic logo reveal
   props: { type: "logo_reveal", logoUrl: "${logoUrl ?? color}", tagline?: string, brandColor: "${color}", style?: "assemble"|"scale_bounce"|"particles_in", mode: "dark"|"light" }

RULES:
1. LANGUAGE: every text / subtext / headline / label / tagline / voiceover field MUST be in ${lang.name}. NEVER translate the brief.
2. Always start with hero_typo (strong hook).
3. Always end with logo_reveal or hero_typo (CTA).
4. Vary the types — never two hero_typo in a row.
5. mode "dark" for dramatic / premium scenes, "light" for product / bright scenes.
6. stats_counter must use real numbers relevant to the brief.
7. voiceover distributes narration across the key scenes (may be empty on dark_light_switch).

Reply ONLY with this valid JSON:
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
