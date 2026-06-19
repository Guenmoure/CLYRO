import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { logger } from '../lib/logger'
import {
  type Scene,
  STYLE_VISUAL_GUIDE,
  planSceneCount,
  splitScriptForChunks,
  validateScriptCoverage,
  STORYBOARD_WPM,
  STORYBOARD_SANITY_LIMIT,
  getStyleLockSuffix,
  applyAntiHallucination,
} from '@clyro/shared'
import { detectLanguage, type DetectedLanguage } from '../lib/detect-language'

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

// Single shared client. Audit 16/06/26 surfaced two duplicate clients in
// routes/brand-agent.ts + routes/brand-campaigns.ts; they now both import
// `anthropic` from here. Centralising avoids three connection pools and
// three configs drifting apart.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
const client = anthropic

/**
 * Tiny retry helper for « short » Claude calls. Audit 16/06/26 P2.5 — the
 * heavy storyboard/motion/campaign calls already retry 3× with backoff,
 * but fixCreativeLayout / generateCtaVariants / generateCampaignSuggestions
 * were single-attempt and silently swallowed transient 5xx from Anthropic.
 * This helper wraps the messages.create() call with N retries + linear
 * backoff so a flaky network doesn't translate into an empty UI list.
 */
async function withClaudeRetry<T>(
  fn:    () => Promise<T>,
  label: string,
  retries: number = 2,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === retries) break
      const delay = 500 * (attempt + 1)
      logger.info({ attempt: attempt + 1, delay, label }, 'Claude retry')
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  logger.warn(
    { err: lastErr instanceof Error ? lastErr.message : String(lastErr), label },
    'Claude retry exhausted',
  )
  throw lastErr
}

// Single MODEL constant for every Claude call. Audit 16/06/26 surfaced
// version drift (claude-sonnet-4-6 in this file, claude-sonnet-4-20250514
// in two routes). All callers must import MODEL from here so we have one
// place to bump versions and a guarantee that every Claude call uses the
// same generation.
export const MODEL = 'claude-sonnet-4-6'

// Audit 16/06/26 P3.1 — Haiku 4.5 for the four « short » calls that don't
// need Sonnet's reasoning depth (binary classification, short copywriting,
// vision layout fix, brand ideation seeds). ~65 % cheaper per call with no
// noticeable quality drop on these tasks. Kept as a separate constant so
// the heavy creative work stays on Sonnet.
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Nombre de scènes par durée cible — utilisé UNIQUEMENT quand l'utilisateur
// fixe une durée explicite. En mode 'auto' (défaut), le nombre de scènes
// est dérivé directement du nombre de mots du script via planSceneCount(),
// SANS plafond. Règle de fer : la longueur de la vidéo est entièrement
// déterminée par la longueur du script — JAMAIS de compression.
const SCENE_COUNT_MAP: Record<string, number> = {
  '6s':   2,
  '15s':  3,
  '30s':  4,
  '60s':  6,
  '120s': 10,
  '180s': 14,
  '300s': 20,
  default: 4,
}

// Sonnet 4.6 supporte jusqu'à 64 000 tokens d'output. On cap chaque appel
// à 16 000 (latence/coût équilibrés) et on chunke pour les scripts longs.
const MAX_OUTPUT_TOKENS = 16_000

// STYLE_VISUAL_GUIDE moved to @clyro/shared/style-guides so the
// Next.js Hub flow (apps/web/app/api/generate-storyboard/route.ts)
// uses the EXACT same descriptions. Keeping two copies in sync was
// the root cause of the "image quality regression" reported in prod
// — the web copy was a thinner, older version of this map.

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

interface ChunkPromptParams {
  script:           string
  style:            string
  brandKit?:        BrandKitContext
  language:         DetectedLanguage
  sceneCount:       number
  estimatedSeconds: number
  startIndex:       number
  isChunked:        boolean
  chunkPosition?:   { current: number; total: number }
}

function buildStoryboardSystemPrompt(): string {
  return `You are the Scene Director for CLYRO. You split scripts into scenes and
generate image prompts for each scene. Faceless content (no on-camera presenter).

═══════════════════════════════════════════════════════════════════════
10 ANTI-HALLUCINATION RULES (non-negotiable — every image_prompt obeys all of them)
═══════════════════════════════════════════════════════════════════════

1. ONE SUBJECT PER IMAGE
   Every image has EXACTLY ONE focal point. Not two objects interacting.
   Not a complex scene with 5 elements. ONE thing the diffusion model
   can render perfectly. If a concept needs multiple elements to be
   understood, SPLIT IT into multiple short scenes (Rule 10).

   BAD: "a wallet on a table next to a phone next to an invoice"
   GOOD: "Close-up of an empty leather wallet lying open on dark wood"

2. NEVER REQUEST READABLE TEXT IN IMAGES
   Diffusion models cannot write legible text. Every "description_visuelle"
   MUST end with "no text, no writing, no letters, no numbers visible".
   Numbers, stats, titles, quotes, CTAs → "overlay" field ONLY.

   BAD: "a price tag showing $1200" / "an invoice for $2,400"
   GOOD: image shows BLANK price tag → overlay carries "$1,200"

3. NEVER REQUEST SCREENS SHOWING CONTENT
   Don't ask for "phone showing social media" or "laptop displaying a
   spreadsheet" — the model paints gibberish UIs. Instead: show the
   DEVICE with a generic glow / light. Specify any required on-screen
   text in the overlay.

   BAD: "a phone screen showing the Instagram feed"
   GOOD: "smartphone face-down on a pillow, soft blue glow underneath
          onto the fabric, late night atmosphere"

4. PHYSICAL, NEVER CONCEPTUAL
   Translate every abstract idea into a physical object the camera can see.
   - "financial freedom" → a golden key on dark velvet
   - "compound interest" → a seedling next to an oak tree
   - "overwhelm" → hands gripping a desk edge, white knuckles
   - "wasted time" → an hourglass with sand almost gone

5. NO FACES
   Faceless content. Show: hands, silhouettes, overhead views, close-ups
   of objects. Never: face expressions, eye contact, identifiable people.
   If the narration mentions a person, picture what they USE or HOLD or
   stand IN, not what they look like.

6. SIMPLE COMPOSITION TEMPLATE
   Every "description_visuelle" follows this skeleton:
     Close-up of [ONE OBJECT], [2-3 physical details],
     [simple background], [light direction], [mood in 2 words],
     no text no writing no letters no numbers visible,
     [LIGHTING_LOCK], [COLOR_LOCK],
     shot on [camera], [lens], shallow depth of field, 8K

7. CONSISTENCY LOCKS — every prompt of the same video carries the same locks
   The caller provides STYLE_LOCK_SUFFIX (palette + temperature + camera
   feel). Append it verbatim at the end of EVERY description_visuelle so
   all scenes share one visual identity. The pipeline also forcibly
   appends it post-Claude as a safety net.

8. SPLIT MULTI-STEP ACTIONS INTO MULTIPLE SCENES
   If the narration describes a sequence ("he opens the wallet, sees
   it's empty, looks at the bill"), split into 2-3 short scenes (3-5s
   each), ONE element per scene. The SEQUENCE tells the story — not
   one crowded image.

9. OVERLAYS CARRY INFORMATION, IMAGES CARRY MOOD
   The image creates ATMOSPHERE. The overlay text carries INFORMATION.
   - Image: empty wallet on dark surface (mood: scarcity)
     Overlay: "$47.23 remaining" (information: exact amount)
   - Image: seedling next to oak tree (mood: growth)
     Overlay: "$100/mo → $227,000" (information: the math)
   Pick AT MOST ONE overlay per scene, with the exact "trigger_word"
   from texte_voix that should fire it.

10. NO REPEATING PATTERNS, NO FIXED CADENCE
    Vary cadrage across the video: alternate Close-up (default) → Medium
    → Overhead → Close-up. Avoid 5 consecutive close-ups OR 5
    consecutive overheads — viewer fatigue. The close-up is the default,
    the others are visual breathing.

═══════════════════════════════════════════════════════════════════════
SCRIPT PRESERVATION (also non-negotiable)
═══════════════════════════════════════════════════════════════════════

The user's script is preserved VERBATIM across the texte_voix fields.
- Do NOT condense, do NOT summarize, do NOT skip any sentence.
- The concatenation of all texte_voix fields, in order, MUST reconstruct
  the original script (modulo whitespace).
- The video's duration is determined ENTIRELY by the script's length.
- If the script is long, produce many scenes. If it's short, produce few.
  Always full coverage.

You reply ONLY with valid JSON, no markdown, no comments.`
}

function buildStoryboardUserPrompt(p: ChunkPromptParams): string {
  const styleGuide = STYLE_VISUAL_GUIDE[p.style] ?? 'professional visual composition'
  // Anti-hallucination locks — same suffix appended to every scene of
  // this video so all images share lighting / palette / camera feel.
  // The pipeline ALSO appends this post-Claude as a safety net (see
  // `applyAntiHallucination`) so a forgotten lock can never reach fal.ai.
  const styleLockSuffix = getStyleLockSuffix(p.style)
  const brandContext = p.brandKit
    ? `\nBRAND KIT "${p.brandKit.name}": use the color palette ${p.brandKit.primary_color}${p.brandKit.secondary_color ? ` / ${p.brandKit.secondary_color}` : ''} in the visual descriptions when relevant.`
    : ''
  const chunkContext = p.isChunked && p.chunkPosition
    ? `\nCHUNK ${p.chunkPosition.current}/${p.chunkPosition.total}: this is part of a longer script. Generate ONLY the scenes for the script excerpt below — the rest is handled by parallel calls. Scene indices in this chunk start at ${p.startIndex}.`
    : ''
  const lang = p.language

  return `${languageHeader(lang)}Break this script into approximately ${p.sceneCount} visual scenes for a "${p.style}" style video.${chunkContext}

REQUIRED VISUAL STYLE for description_visuelle: ${styleGuide}${brandContext}

═══════════════════════════════════════════════════════════════════════
STYLE_LOCK_SUFFIX — append VERBATIM to every description_visuelle in this video
(repeats across all scenes so they share one identity — palette, lighting,
finishing). Stays in English.
═══════════════════════════════════════════════════════════════════════
${styleLockSuffix}
═══════════════════════════════════════════════════════════════════════

For each scene, produce:
- "id": unique identifier ("scene_${String(p.startIndex + 1).padStart(3, '0')}", "scene_${String(p.startIndex + 2).padStart(3, '0')}", …)
- "index": scene number (starts at ${p.startIndex})
- "description_visuelle": visual prompt in ENGLISH optimised for Flux image generation (40–80 words is the sweet spot, hard cap 150 chars). MUST follow the 4-LAYER STRUCTURE below and the visual style above. Never mention identifiable real people. Never request readable numbers/stats/titles/quotes in the image — those go in "overlay".
- "animation_prompt": motion prompt in ENGLISH for image-to-video (max 80 chars). Describes ONE primary subject motion + ONE camera move, ending with "smooth cinematic motion". Examples: "slow zoom in, character gestures forward, smooth cinematic motion", "camera pans left, gentle wind effect, smooth cinematic motion".
- "texte_voix": REQUIRED — narration text written in ${lang.name} (the script's language). NEVER translate. Always filled, never empty. Matches the corresponding portion of the script VERBATIM. Cumulatively across all scenes, every word of the script MUST appear.
- "duree_estimee": duration in seconds (integer, between 3 and 12). Sum across all scenes ≈ ${p.estimatedSeconds}s (~${STORYBOARD_WPM} wpm narration of the script). Adjust naturally per scene based on the length of its texte_voix.
- "faceless_scene_type": one of "broll" | "infographic" | "typography" | "demo". Pick the template that fits this scene's PURPOSE:
    • "broll"       — atmospheric narrative scene (no overlay, or just a key_phrase / source). Rich detailed image, full frame.
    • "infographic" — scene illustrating a number / stat / comparison. Backdrop is a SILENT chart or data viz with negative space in the CENTER for the overlay.
    • "typography"  — scene where the headline / key_phrase IS the content. Backdrop is minimal / abstract with full-frame negative space.
    • "demo"        — scene about an interface, app, product or workflow. Image is a clean mockup with focused subject.
  Picking the wrong template makes the image fight the overlay — be precise.
- "overlay" (OPTIONAL): object { "type": "stat"|"headline"|"key_phrase"|"comparison"|"list_item"|"source"|"cta", "text": "…", "position": "top-center"|"center"|"bottom-center"|… , "trigger_word": "…", "duration_seconds": 2-5 }
  Pick AT MOST ONE overlay type per scene. Use them like this:
    • "stat"       — every time the narration mentions a specific number ("$250,000", "87%"). text = the number only, max 12 chars. position default "center".
    • "headline"   — at the start of a new numbered section ("MISTAKE #3", "RULE 1"). max 20 chars. position default "top-center".
    • "key_phrase" — the most quotable line of the scene ("YOU'RE NOT LAZY"). max 30 chars. position default "center".
    • "comparison" — contrast two ideas, formatted "BEFORE | AFTER" or "POOR | RICH". max 30 chars total. position "center".
    • "list_item"  — numbered list entry ("#3 — LIFESTYLE INFLATION"). max 30 chars. position "center".
    • "source"     — citation ("Harvard Study, 2018"). max 60 chars. position default "bottom-center".
    • "cta"        — call-to-action ("Subscribe", "Try free"). max 18 chars. position default "bottom-center".
  → "trigger_word" = the exact word from texte_voix that should make the overlay appear (must match a word that's in this scene's narration verbatim).
  → "duration_seconds" = how long the overlay stays on screen (2–5s). Defaults to 3 if omitted.
  → "text" must stay in ${lang.name}. Omit the overlay entirely if the scene has no memorable beat.

═══════════════════════════════════════════════════════════════════════
4-LAYER STRUCTURE for description_visuelle (mandatory order):
  1. SUBJECT     — the main visual element with specific attributes (object, action, pose)
  2. ENVIRONMENT — background, secondary elements, spatial context
  3. LIGHTING    — direction, temperature, atmosphere ("warm directional light from upper left, dramatic shadows")
  4. TECHNICAL   — camera/lens/finish ("shot on Canon R5, 85mm, shallow DoF, 8K, photorealistic")
Always end with "8K" or "8K resolution".
NEVER mention identifiable real people — use hands, silhouettes, objects, landscapes, abstract shapes.

Adapt the SUBJECT + ENVIRONMENT layers to faceless_scene_type:
  • broll       → rich narrative scene, no negative-space request
  • infographic → object/icon related to the data + "wide negative space in the CENTER for text overlay" in ENVIRONMENT
  • typography  → minimal abstract surface (smoke, gradient, light beam, single object) + "full-frame negative space for centered text" in ENVIRONMENT
  • demo        → clean device or interface mockup, focused subject, soft ambient light
═══════════════════════════════════════════════════════════════════════

CRITICAL RULES:
1. LANGUAGE: every "texte_voix" and every "overlay.text" MUST be written in ${lang.name}. Never translate the script. "description_visuelle" and "animation_prompt" stay in English (Flux/Kling consume them).
2. description_visuelle MUST visually match the "${p.style}" style — strictly apply: ${styleGuide}
3. animation_prompt MUST describe a concrete movement visible in the scene (never generic).
4. texte_voix is REQUIRED on every scene — distribute the full script across ALL scenes verbatim, in ${lang.name}, omitting NOTHING.
5. The total duration must FAITHFULLY reflect the script length (~${STORYBOARD_WPM} wpm spoken). Do NOT condense, do NOT shorten — every sentence is narrated in full.
6. Numbers, stats, titles, CTAs → "overlay" field ONLY, never inside "description_visuelle".
7. trigger_word MUST be a word that actually appears in this scene's texte_voix — pipeline uses it for word-level sync.
8. The number of scenes adapts to the script length. ${p.sceneCount} is a target — adjust ±20% if needed to keep each texte_voix natural (one full thought per scene).

Script (treat as ${lang.name} content — preserve verbatim across texte_voix fields):
"""
${p.script}
"""

Reply ONLY with this valid JSON:
{
  "scenes": [...],
  "total_duration": <sum of durations>
}`
}

async function callClaudeForStoryboardChunk(p: ChunkPromptParams): Promise<StoryboardResult> {
  const systemPrompt = buildStoryboardSystemPrompt()
  const userPrompt = buildStoryboardUserPrompt(p)
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      })

      logger.info(
        {
          model:        MODEL,
          inputTokens:  message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          durationMs:   Date.now() - startTime,
          attempt,
          chunk:        p.chunkPosition,
        },
        'Claude storyboard chunk generated'
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
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, error: lastError.message, chunk: p.chunkPosition },
        'Claude storyboard chunk attempt failed, retrying'
      )
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(`Storyboard chunk generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

export async function generateStoryboard(
  script: string,
  style: string,
  targetDuration = '30s',
  brandKit?: BrandKitContext,
  language?: DetectedLanguage,
): Promise<StoryboardResult> {
  const masterSeed = generateMasterSeed(script)
  const lang: DetectedLanguage = language ?? { code: 'en', name: 'English', nativeName: 'English' }

  // Plan: word count → scene count → chunk count. NO CAP — la durée vidéo
  // est entièrement déterminée par le script, jamais raccourci.
  const plan = planSceneCount(script, targetDuration, SCENE_COUNT_MAP)

  if (plan.sceneCount > STORYBOARD_SANITY_LIMIT) {
    logger.warn(
      { wordCount: plan.wordCount, sceneCount: plan.sceneCount, sanityLimit: STORYBOARD_SANITY_LIMIT },
      'Very long script — generating without truncation as user requested'
    )
  }

  // Single-call path
  if (plan.chunkCount === 1) {
    const result = await callClaudeForStoryboardChunk({
      script,
      style,
      brandKit,
      language:         lang,
      sceneCount:       plan.sceneCount,
      estimatedSeconds: plan.estimatedSeconds,
      startIndex:       0,
      isChunked:        false,
    })

    const coverage = validateScriptCoverage(script, result.scenes as Array<{ texte_voix?: string }>)
    if (!coverage.ok) {
      logger.warn({ coverage }, 'Storyboard coverage low — Claude may have compressed the script')
    }
    // Anti-hallucination safety net: force the no-text suffix + style
    // lock onto every description_visuelle. Idempotent — Claude is told
    // to include them in the prompt, this is the belt-and-braces in
    // case it forgets on one scene.
    for (const scene of result.scenes) {
      if (scene.description_visuelle) {
        scene.description_visuelle = applyAntiHallucination(scene.description_visuelle, style)
      }
    }
    result.master_seed = masterSeed
    return result
  }

  // Multi-chunk path: split + parallel generate + merge with re-numbered indices
  const scriptChunks = splitScriptForChunks(script, plan.chunkCount)
  const chunkPlans = scriptChunks.map((chunk) => planSceneCount(chunk, 'auto'))
  let runningIndex = 0
  const startIndices = chunkPlans.map((cp) => {
    const start = runningIndex
    runningIndex += cp.sceneCount
    return start
  })

  const chunkResults = await Promise.all(
    scriptChunks.map((chunk, i) => callClaudeForStoryboardChunk({
      script:           chunk,
      style,
      brandKit,
      language:         lang,
      sceneCount:       chunkPlans[i].sceneCount,
      estimatedSeconds: chunkPlans[i].estimatedSeconds,
      startIndex:       startIndices[i],
      isChunked:        true,
      chunkPosition:    { current: i + 1, total: scriptChunks.length },
    })),
  )

  // Merge: re-number indices to be globally sequential and contiguous +
  // apply the anti-hallucination safety net to every scene (forces the
  // no-text suffix + style lock if Claude omitted them on a chunk).
  let globalIndex = 0
  const mergedScenes: Scene[] = []
  for (const result of chunkResults) {
    const sortedScenes = [...result.scenes].sort((a, b) => a.index - b.index)
    for (const scene of sortedScenes) {
      const safeScene = {
        ...scene,
        index: globalIndex,
        id:    `scene_${String(globalIndex + 1).padStart(3, '0')}`,
        description_visuelle: scene.description_visuelle
          ? applyAntiHallucination(scene.description_visuelle, style)
          : scene.description_visuelle,
      }
      mergedScenes.push(safeScene)
      globalIndex += 1
    }
  }
  const totalDuration = mergedScenes.reduce((s, sc) => s + (sc.duree_estimee || 5), 0)

  const coverage = validateScriptCoverage(script, mergedScenes as Array<{ texte_voix?: string }>)
  if (!coverage.ok) {
    logger.warn(
      { coverage, chunkCount: scriptChunks.length },
      'Chunked storyboard coverage low across chunks'
    )
  }
  logger.info(
    {
      wordCount:        plan.wordCount,
      sceneCount:       mergedScenes.length,
      chunkCount:       scriptChunks.length,
      coveragePreserved: `${coverage.storyboardWords}/${coverage.originalWords}`,
    },
    'Chunked storyboard merged'
  )

  return {
    scenes:         mergedScenes,
    total_duration: totalDuration,
    master_seed:    masterSeed,
  }
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
  /**
   * Per-scene voiceover text, indexed by scene position. An empty string
   * means the scene plays silently (dark_light_switch, pure visual beats).
   * The pipeline runs ElevenLabs per scene in parallel and attaches each
   * audio buffer back to the corresponding scene via
   * `MotionScene.voiceoverAudioUrl`.
   */
  voiceovers: string[]
  /**
   * Concatenated voiceover (legacy field, kept for any caller that still
   * wants a flat script — e.g. caption generation or downstream search).
   */
  voiceoverScript: string
  totalFrames: number
}

// ── Zod schemas for Claude's motion-design output ────────────────────────
// Every scene type has its own props schema so a missing field (e.g.
// `stats[]` on stats_counter) fails validation cleanly INSTEAD of silently
// producing a broken video that crashes at render time. The old code
// JSON.parse-cast-as-MotionScene[] which let malformed responses through.

const heroTypoPropsZ = z.object({
  type:      z.literal('hero_typo'),
  text:      z.string().min(1),
  subtext:   z.string().optional(),
  mode:      z.enum(['dark', 'light']),
  animation: z.enum(['word_by_word', 'line_by_line', 'scale_bounce', 'split_reveal', '3d_rotate']),
  color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontSize:  z.number().int().min(20).max(400).optional(),
})
const cardsPropsZ = z.object({
  type: z.literal('3d_cards'),
  cards: z.array(z.object({
    avatar:   z.string().optional(),
    name:     z.string(),
    content:  z.string(),
    metrics:  z.object({ likes: z.number().optional(), comments: z.number().optional() }).optional(),
    platform: z.enum(['instagram', 'linkedin', 'tiktok', 'twitter']).optional(),
  })).min(1).max(6),
  headline: z.string(),
  mode:     z.enum(['dark', 'light']),
  layout:   z.enum(['scatter', 'v_shape', 'tunnel', 'orbit']).optional(),
})
const statsPropsZ = z.object({
  type: z.literal('stats_counter'),
  stats: z.array(z.object({
    value: z.number(),
    unit:  z.string(),
    label: z.string(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })).min(1).max(4),
  headline: z.string().optional(),
  mode:     z.enum(['dark', 'light']),
})
const floatingPropsZ = z.object({
  type: z.literal('floating_icons'),
  icons: z.array(z.object({
    emoji: z.string(),
    label: z.string(),
    color: z.string(),
  })).min(1).max(8),
  headline:     z.string(),
  notification: z.object({ avatar: z.string(), text: z.string() }).optional(),
  mode:         z.enum(['dark', 'light']),
})
const darkLightPropsZ = z.object({
  type:      z.literal('dark_light_switch'),
  direction: z.enum(['dark_to_light', 'light_to_dark']),
  style:     z.enum(['flash', 'wipe', 'circle_reveal']).optional(),
})
const logoRevealPropsZ = z.object({
  type:       z.literal('logo_reveal'),
  logoUrl:    z.string(),
  tagline:    z.string().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  style:      z.enum(['assemble', 'scale_bounce', 'particles_in']).optional(),
  mode:       z.enum(['dark', 'light']),
})
// Audit 16/06/26 — `avatar_grid` and `mockup_zoom` used to live here and
// in the type enum, but the main Claude prompt (lines 902+) never lists
// them as available scene types and their props require inputs Claude
// cannot synthesise (avatar URLs, screenshotUrl, focusArea, cursorPath).
// They were dead code Claude-side and caused silent black-frame renders
// if the model ever wandered into them. Removed from the Zod schema.
// The Remotion composition still ships SceneAvatarGrid / SceneMockupZoom
// renderers for potential future use (e.g. a deterministic non-Claude
// caller), so no composition file is deleted.
const sceneZ = z.object({
  id:        z.string().min(1),
  type:      z.enum(['3d_cards','hero_typo','dark_light_switch','floating_icons','stats_counter','logo_reveal']),
  duration:  z.number().int().min(30).max(300),
  voiceover: z.string().optional(),
  props:     z.discriminatedUnion('type', [
    heroTypoPropsZ, cardsPropsZ, statsPropsZ, floatingPropsZ,
    darkLightPropsZ, logoRevealPropsZ,
  ]),
})
const motionStoryboardZ = z.object({
  scenes: z.array(sceneZ).min(1).max(30),
})

/**
 * Sous-ensemble enrichi du Brand Kit (« Business DNA ») exploité par les
 * prompts Claude. Tous les champs sont optionnels : un kit qui n'a que
 * primary_color reste valide, mais plus le DNA est riche plus la vidéo
 * générée sera on-brand. Cf. supabase/migrations/20260601000000_brand_dna_extension.sql
 * et docs/POMELLI_BRAND_KIT_PLAN.md (Phase 1).
 */
export interface BrandConfigForPrompt {
  primary_color: string
  secondary_color?: string
  logo_url?:        string
  font_family?:     string
  // — Business DNA injecté dans le brandLine du prompt —
  tagline?:             string
  brand_values?:        string[]
  brand_aesthetic?:     string[]
  brand_tone_of_voice?: string[]
  business_overview?:   string
}

/**
 * Construit les lignes de « brand DNA » à injecter dans le system/user
 * prompt. Chaque ligne est conditionnelle : on n'ajoute la ligne que si
 * la donnée est présente et non vide. Utilisé par generateMotionDesignScenes
 * et generateMotionStoryboard pour produire des vidéos réellement on-brand.
 */
function buildBrandDnaPromptLines(brand: BrandConfigForPrompt): string[] {
  const lines: string[] = []
  if (brand.tagline && brand.tagline.trim().length > 0) {
    lines.push(`Brand tagline: "${brand.tagline.trim()}"`)
  }
  if (brand.brand_tone_of_voice && brand.brand_tone_of_voice.length > 0) {
    lines.push(`Brand tone of voice: ${brand.brand_tone_of_voice.join(', ')}. Match this tone in every text field, voiceover, headline.`)
  }
  if (brand.brand_values && brand.brand_values.length > 0) {
    lines.push(`Brand values to convey: ${brand.brand_values.join(', ')}.`)
  }
  if (brand.brand_aesthetic && brand.brand_aesthetic.length > 0) {
    lines.push(`Visual aesthetic to honor: ${brand.brand_aesthetic.join(', ')}.`)
  }
  if (brand.business_overview && brand.business_overview.trim().length > 0) {
    // Tronqué à 600 caractères pour ne pas exploser le budget de tokens
    // sur des descriptions longues — l'essence du business suffit.
    const overview = brand.business_overview.trim()
    lines.push(`Business context: ${overview.length > 600 ? overview.slice(0, 600) + '…' : overview}`)
  }
  return lines
}

export async function generateMotionDesignScenes(
  brief: string,
  format: string,
  duration: string,
  brandConfig: BrandConfigForPrompt,
  language?: DetectedLanguage,
  /** Visual register hint — biases Claude's scene-type picks toward the right
   *  feel. Optional; when missing Claude picks a balanced mix. */
  styleHint?: 'corporate' | 'dynamique' | 'luxe' | 'fun',
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
  const secondary = brandConfig.secondary_color ?? null
  const fontFamily = brandConfig.font_family ?? null
  const logoUrl = brandConfig.logo_url ?? null

  // Style register — STRICT constraints, not soft hints. Claude regularly
  // ignored "prefer" wording in the previous prompt so the 4 registers
  // produced near-identical mixes. Each register now lists the EXACT scene
  // types allowed, mode bias, and what to NEVER use.
  const styleRegister: Record<string, string> = {
    // Audit 16/06/26 — removed `mockup_zoom` mentions: scene type was dropped
    // from the Zod schema (Claude can't synthesise the required screenshot /
    // cursor data). Style guidance now only references reachable types.
    corporate: 'STYLE = CORPORATE: confident, structured, high-trust. ALLOWED scene types: hero_typo (animations: line_by_line OR 3d_rotate only), stats_counter, logo_reveal (style: assemble). Mode bias: "light" on ≥ 60 % of scenes. FORBIDDEN: floating_icons with emojis, 3d_cards scatter, hero_typo split_reveal, dark_light_switch flash.',
    dynamique: 'STYLE = DYNAMIQUE: high-energy, fast-paced, social. ALLOWED scene types: 3d_cards (layout: scatter OR orbit), floating_icons, dark_light_switch (style: flash OR wipe), hero_typo (animations: word_by_word OR scale_bounce only). Mode bias: alternate dark/light every scene. FORBIDDEN: long hero_typo 3d_rotate.',
    luxe:      'STYLE = LUXE: slow, refined, cinematic. ALLOWED scene types: hero_typo (animations: 3d_rotate OR scale_bounce only, fontSize ≥ 140), dark_light_switch (style: circle_reveal only), logo_reveal (style: particles_in). Mode bias: "dark" on ≥ 70 % of scenes. FORBIDDEN: floating_icons, 3d_cards scatter, hero_typo split_reveal.',
    fun:       'STYLE = FUN: playful, colorful, expressive. ALLOWED scene types: 3d_cards (layout: scatter), floating_icons (5-8 emoji icons), hero_typo (animations: split_reveal OR scale_bounce only), dark_light_switch (style: flash). Mode bias: "light" with vibrant accents. FORBIDDEN: hero_typo 3d_rotate, logo_reveal assemble.',
  }
  const styleLine = styleHint ? `\n${styleRegister[styleHint]}\n` : ''
  // brandLine : couleurs / fonte / logo (visuel) + DNA enrichi (sémantique).
  // Le DNA (tagline, ton, valeurs, esthétique, contexte business) est ce qui
  // permet à Claude de produire des scènes vraiment on-brand au lieu de scènes
  // « génériques avec la bonne couleur ». Cf. docs/POMELLI_BRAND_KIT_PLAN.md §1.
  const brandLine = [
    `Brand primary color: ${color}`,
    secondary ? `Brand secondary color: ${secondary} (use for stats counters second highlight, particles, accents)` : null,
    fontFamily ? `Brand font hint: ${fontFamily} (the frontend loads it via Remotion; you only need to keep text concise and well-spaced)` : null,
    logoUrl ? `Logo URL: ${logoUrl}` : null,
    ...buildBrandDnaPromptLines(brandConfig),
  ].filter(Boolean).join('\n')

  // Hard WPM ceiling — used by the prompt to bound voiceover length per
  // scene AND by the backend to abort generation if Claude blows past it.
  // Pro VO French ≈ 150 wpm = 2.5 words/sec, so a 30s video supports ≤ 75
  // narrated words MAX (we use a 80 % budget for breathing).
  const TARGET_SECONDS = ({
    '6s': 6, '15s': 15, '30s': 30, '60s': 60, '90s': 90, '120s': 120,
    '180s': 180, '300s': 300, 'auto': 60,
  } as Record<string, number>)[duration] ?? 30
  const MAX_TOTAL_WORDS = Math.floor((TARGET_SECONDS * 2.5) * 0.8)
  const MAX_WORDS_PER_SCENE = Math.floor(MAX_TOTAL_WORDS / sceneCount)

  const userPrompt = `${languageHeader(lang)}Create an F2 Motion Design sequence of ${sceneCount} scenes for this brief:

"""
${brief}
"""

Video format: ${format}
Target duration: ${duration} (${TARGET_SECONDS}s)
${brandLine}${styleLine}

Each scene is a JSON object with these fields:
- "id": unique string ("scene_001", "scene_002", …)
- "type": one of the scene types below
- "duration": HINT in frames at 30 fps (the backend will OVERRIDE this from the
  actual TTS audio length to keep voice & visuals in sync — your hint is used
  only as a fallback when a scene has empty voiceover). Use 60-210 range.
- "props": props object matching the type (see types below)
- "voiceover": narration text in ${lang.name} (NEVER translate; may be "" on
  scenes without narration like dark_light_switch).

VOICEOVER WORD BUDGET — non-negotiable:
- Total voiceover across all scenes MUST be ≤ ${MAX_TOTAL_WORDS} words.
  Computed from 150 wpm × ${TARGET_SECONDS}s × 80 % safety margin.
- Per scene: ≤ ${MAX_WORDS_PER_SCENE} words on average. Don't pile 200 words
  onto one scene and leave the others empty.
- Visual-only scenes (dark_light_switch, logo_reveal without tagline) have
  voiceover: "" and contribute zero to the budget.

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

      // Zod-validate Claude's JSON. A missing `stats[]` on stats_counter
      // or `cards[]` on 3d_cards used to slip through and crash Remotion
      // at render time; now it fails fast with a precise error so the
      // retry loop can ask Claude to fix the exact field.
      const rawParsed = JSON.parse(jsonText) as unknown
      const validation = motionStoryboardZ.safeParse(rawParsed)
      if (!validation.success) {
        const issues = validation.error.issues.slice(0, 5)
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join(' | ')
        throw new Error(`Storyboard validation failed: ${issues}`)
      }
      const parsed = validation.data

      // Per-scene voiceover array — preserves alignment with scenes[i].
      // Empty string for visual-only scenes (dark_light_switch, etc.).
      const voiceovers = parsed.scenes.map((s) => (s.voiceover ?? '').trim())

      // Flat script kept for callers that want a single text blob
      // (caption fallback, search indexing, telemetry).
      const voiceoverScript = voiceovers.filter((v) => v.length > 0).join(' ')

      // Convert to MotionScene[] (strip voiceover from final props — it's separate)
      const scenes = parsed.scenes.map((s) => ({
        id:       s.id,
        type:     s.type as import('@clyro/video').MotionSceneType,
        duration: Math.max(30, s.duration),
        props:    s.props as import('@clyro/video').MotionSceneProps,
      }))

      const totalFrames = scenes.reduce((sum, s) => sum + s.duration, 0)

      return { scenes, voiceovers, voiceoverScript, totalFrames }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, maxRetries: MAX_RETRIES, error: lastError.message }, 'Claude motion design attempt failed, retrying')
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(`Motion design scene generation failed: ${lastError?.message ?? 'Unknown error'}`)
}

// ── Motion brief classifier (auto-router) ──────────────────────────────────────
// CLYRO has two motion engines:
//   - "graphics" → runMotionPipeline : storyboard + AI-generated images
//     (fal.ai) animated by Remotion's DynamicComposition. Use when the
//     video needs real imagery — photos, scenes, illustrated backgrounds,
//     characters, places, products shown as pictures.
//   - "design"   → runMotionDesignPipeline : agency-quality scenes rendered
//     100 % in code (typography, data counters, icons, logo reveals). Use
//     when the video is carried by animated text / graphics, no generated
//     photos needed.
// This classifier reads the brief and picks ONE engine for the whole video.
// It runs as step 0 inside the worker (see pipelines/motion-router.ts) so it
// never adds latency to the HTTP response.

export type MotionRenderKind = 'graphics' | 'design'

export interface MotionClassification {
  render: MotionRenderKind
  /** One-sentence rationale — logged for observability, not shown to users. */
  reason: string
}

/**
 * Classifies a motion brief into the engine that fits it best.
 * Cheap call (max_tokens 200). Retries MAX_RETRIES times, then falls back to
 * "design" — the lower-cost path (no fal.ai image spend) and the safer
 * default when intent is ambiguous.
 */
export async function classifyMotionBrief(
  brief: string,
  script?: string,
): Promise<MotionClassification> {
  const source = script && script.trim().length > 0
    ? `${brief}\n\n--- Script ---\n${script}`
    : brief

  const systemPrompt = `You route a video brief to one of two render engines. You reply ONLY with valid JSON, no markdown, no comments.`

  const userPrompt = `Pick the render engine that fits this video brief.

"""
${source.slice(0, 4000)}
"""

Two engines:
- "graphics": the brief NEEDS AI-generated imagery — photos, realistic scenes, illustrated backgrounds, characters, places, or products shown as pictures. Choose this when the video would look empty or generic without generated images.
- "design": the brief is carried by animated TEXT, data, numbers, icons, logos, UI mockups — pure motion design. No generated photos needed.

If the intent is ambiguous, choose "design".

Reply ONLY with this valid JSON:
{ "render": "graphics" | "design", "reason": "<one short sentence>" }`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Audit 16/06/26 P3.1 — Haiku for the binary classifier.
      const message = await client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

      const jsonText = content.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const parsed = JSON.parse(jsonText) as { render?: unknown; reason?: unknown }
      const render: MotionRenderKind = parsed.render === 'graphics' ? 'graphics' : 'design'
      const reason = typeof parsed.reason === 'string' ? parsed.reason : ''
      logger.info({ render, reason, attempt }, 'Motion brief classified')
      return { render, reason }
    } catch (err) {
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, error: err instanceof Error ? err.message : String(err) },
        'Motion brief classification attempt failed',
      )
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  logger.warn('Motion brief classification failed after retries — defaulting to design')
  return { render: 'design', reason: 'classification failed; defaulted to design' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Fix Layout vision (Phase 3.4 V2.5) ──────────────────────────────────────
// Demande à Claude d'analyser l'image d'une créative et de proposer de
// meilleures positions pour les blocs visibles afin d'éviter les zones
// chargées (visages, ciels uniformes, contrastes faibles). Multimodal :
// envoie l'URL d'image + un prompt structuré, attend des coords en %.

export interface FixLayoutPositions {
  header?:      { x: number; y: number }
  description?: { x: number; y: number }
  cta?:         { x: number; y: number }
}

/** Couleur de texte suggérée pour chaque bloc selon le fond de l'image
 *  derrière ce bloc. Permet d'afficher du noir sur des images très claires
 *  et du blanc sur des images très sombres — point central de la V3
 *  Phase 3.4. */
export interface FixLayoutColors {
  header?:      'white' | 'black'
  description?: 'white' | 'black'
  cta?:         'white' | 'black'
}

export interface FixLayoutResult {
  positions: FixLayoutPositions
  colors:    FixLayoutColors
}

export async function fixCreativeLayout(input: {
  imageUrl:    string
  visible:     { header: boolean; description: boolean; cta: boolean }
  current?:    FixLayoutPositions
}): Promise<FixLayoutResult> {
  const askBlocks = Object.entries(input.visible)
    .filter(([, on]) => on)
    .map(([k]) => k)
  if (askBlocks.length === 0) return { positions: {}, colors: {} }

  const systemPrompt = `You are a senior art director optimizing the layout AND legibility of social-media creative text overlays. You reply ONLY with valid JSON.`
  const userPrompt = `Examine the image and suggest, for each visible text block:
1. WHERE to place it so it is LEGIBLE and DOESN'T cover faces, logos in the picture, or busy/high-contrast areas.
2. WHAT TEXT COLOR to use ("white" or "black") so the block is readable against the background it sits on. Choose black if the area behind the block is bright (sky, snow, light wall…) and white if the area is dark or saturated.

VISIBLE BLOCKS: ${askBlocks.join(', ')}
${input.current ? `CURRENT POSITIONS (for context): ${JSON.stringify(input.current)}` : ''}

Position coordinates are the CENTER of each block, in percent of the image (x=0 left, x=100 right, y=0 top, y=100 bottom). Keep each x,y within [5..95] so blocks stay inside the frame.

Reply ONLY with this JSON:
{
${askBlocks.map((k) => `  "${k}": { "x": <num>, "y": <num>, "color": "white" | "black" }`).join(',\n')}
}`

  try {
    // L'Anthropic SDK ne supporte que source: 'base64' (pas 'url'). On
    // télécharge l'image côté serveur (plafond 5 MB) puis on l'encode.
    const imgRes = await fetch(input.imageUrl)
    if (!imgRes.ok) throw new Error(`Image fetch ${imgRes.status}`)
    const buf = Buffer.from(await imgRes.arrayBuffer())
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error('Image too large for vision call')
    const ctype = (imgRes.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim().toLowerCase()
    const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      ctype === 'image/png'  ? 'image/png'  :
      ctype === 'image/webp' ? 'image/webp' :
      ctype === 'image/gif'  ? 'image/gif'  : 'image/jpeg'

    // Audit 16/06/26 P3.1 — Haiku 4.5 vision for the layout fix.
    const message = await withClaudeRetry(
      () => client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
            { type: 'text',  text:   userPrompt },
          ],
        }],
      }),
      'fixCreativeLayout',
    )
    const content = message.content[0]
    if (content.type !== 'text') return { positions: {}, colors: {} }
    const jsonText = content.text
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const positions: FixLayoutPositions = {}
    const colors:    FixLayoutColors    = {}
    for (const key of askBlocks as Array<'header' | 'description' | 'cta'>) {
      const v = parsed[key] as { x?: unknown; y?: unknown; color?: unknown } | undefined
      if (!v) continue
      const x = typeof v.x === 'number' ? Math.max(0, Math.min(100, v.x)) : null
      const y = typeof v.y === 'number' ? Math.max(0, Math.min(100, v.y)) : null
      if (x !== null && y !== null) positions[key] = { x, y }
      if (v.color === 'white' || v.color === 'black') colors[key] = v.color
    }
    return { positions, colors }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Fix layout vision call failed')
    return { positions: {}, colors: {} }
  }
}

// ── CTA variants (Phase 3.4 V2) ──────────────────────────────────────────────
// Petit appel Claude (max_tokens 300) qui propose 3 CTA on-brand depuis le
// contexte d'une créative et le DNA. Pas de retry — l'utilisateur peut
// re-cliquer si besoin.

export interface CtaVariantsInput {
  /** Contexte de la créative pour orienter le ton. */
  header?:      string
  description?: string
  /** CTA courant — sert d'amorce, à varier. */
  current?:     string
  brand:        BrandConfigForPrompt & { name?: string }
  /** Nombre de variantes. Défaut 3, max 6. */
  count?:       number
}

export async function generateCtaVariants(input: CtaVariantsInput): Promise<string[]> {
  const count = Math.max(1, Math.min(6, input.count ?? 3))
  const sourceText = `${input.header ?? ''} ${input.description ?? ''}`.trim() || input.current || 'the campaign'
  const lang: DetectedLanguage = detectLanguage(sourceText)
  const dnaLines = buildBrandDnaPromptLines(input.brand)

  const systemPrompt = `You write call-to-action copy. You reply ONLY with valid JSON.`
  const userPrompt = `Propose ${count} distinct call-to-action options for this creative.

CREATIVE CONTEXT:
${input.header      ? `Header: ${input.header}\n` : ''}${input.description ? `Description: ${input.description}\n` : ''}${input.current ? `Current CTA: ${input.current}\n` : ''}
BRAND:
Primary color: ${input.brand.primary_color}
${dnaLines.join('\n')}

Rules:
- ≤ 30 characters each. Imperative. In ${lang.name}.
- Each variant feels distinct (different angle: urgency / curiosity /
  warmth / value).
- NEVER include any agency or platform name.

Reply ONLY with this JSON: { "variants": ["...", "...", "..."] }`

  try {
    // Audit 16/06/26 P3.1 — Haiku for short copywriting variants.
    const message = await withClaudeRetry(
      () => client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      'generateCtaVariants',
    )
    const content = message.content[0]
    if (content.type !== 'text') return []
    const jsonText = content.text
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()
    const parsed = JSON.parse(jsonText) as { variants?: unknown }
    if (!Array.isArray(parsed.variants)) return []
    return parsed.variants
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim().slice(0, 60))
      .filter((v) => v.length > 0)
      .slice(0, count)
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'CTA variants generation failed')
    return []
  }
}

// ── Brand Campaign suggestions (Phase 3.2) ──────────────────────────────────
// 3 idées de campagne dérivées du seul DNA — pas de prompt utilisateur, pas
// de génération d'image. Sert d'amorce dans la box (« Suggestions based on
// Business DNA »). Appel court (max_tokens 800), pas de retry agressif.

export interface CampaignSuggestion {
  title:       string
  description: string
  /** Prompt prêt à l'emploi pour pré-remplir la box de création. */
  prompt:      string
}

export async function generateCampaignSuggestions(
  brand: BrandConfigForPrompt & { name?: string },
  count = 3,
): Promise<CampaignSuggestion[]> {
  const lang: DetectedLanguage = brand.business_overview
    ? detectLanguage(brand.business_overview)
    : { code: 'en', name: 'English', nativeName: 'English' }

  const dnaLines = buildBrandDnaPromptLines(brand)
  const brandName = brand.name ?? 'the brand'

  const systemPrompt = `You are a senior creative director. You reply ONLY with valid JSON. No markdown, no comments.`

  const userPrompt = `Propose ${count} campaign ideas for "${brandName}" derived from its brand DNA.

BRAND DNA:
Primary color: ${brand.primary_color}
${dnaLines.join('\n')}

Each idea has:
- title: short campaign name (≤ 50 chars), in ${lang.name}.
- description: 1-sentence pitch (≤ 140 chars), in ${lang.name}.
- prompt: a starter prompt that a marketer could feed back to the campaign
  generator to actually produce it. 2-3 sentences, descriptive. In ${lang.name}.

Each idea must feel meaningfully different from the others.

Reply ONLY with this JSON:
{ "suggestions": [ { "title": "...", "description": "...", "prompt": "..." } ] }`

  try {
    // Audit 16/06/26 P3.1 — Haiku for brand ideation seeds.
    const message = await withClaudeRetry(
      () => client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      'generateCampaignSuggestions',
    )
    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
    const jsonText = content.text
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()
    const parsed = JSON.parse(jsonText) as { suggestions?: CampaignSuggestion[] }
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return list.slice(0, count)
      .filter((s): s is CampaignSuggestion =>
        !!s && typeof s.title === 'string' && typeof s.description === 'string' && typeof s.prompt === 'string',
      )
      .map((s) => ({
        title:       s.title.trim().slice(0, 60),
        description: s.description.trim().slice(0, 240),
        prompt:      s.prompt.trim().slice(0, 600),
      }))
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Campaign suggestions failed')
    return []
  }
}

// ── Brand Campaign brief (Phase 3.1 du portage Pomelli) ─────────────────────
// Génère un brief structuré pour une campagne : titre, description, et 3
// créatives (image prompt + header + description + CTA). Le DNA du Brand
// Kit guide tout : tagline, ton, valeurs, esthétique. Plus le DNA est
// riche, plus les créatives sont vraiment on-brand.

export interface CampaignBriefInput {
  /** Prompt brut de l'utilisateur (ce qu'il a écrit dans la box). */
  prompt:    string
  brandKit:  BrandConfigForPrompt & { name?: string }
  product?:  { name: string; description?: string | null; category?: string | null } | null
  /** Description courte d'assets de référence (max 5 prises en compte). */
  assetHints?: string[]
  /** Nombre de créatives à générer. Défaut 3 — limite haute 6. */
  count?:    number
}

export interface CampaignCreativeBrief {
  visual_prompt: string
  header:        string
  description:   string
  cta:           string
}

export interface CampaignBriefResult {
  campaign_title:       string
  campaign_description: string
  creatives:            CampaignCreativeBrief[]
}

/**
 * Demande à Claude un brief structuré pour la campagne. Renvoie 3 (ou N)
 * créatives prêtes à être envoyées à fal.ai pour la génération d'image,
 * + un titre / description pour la campagne elle-même.
 *
 * Retry MAX_RETRIES sur erreur de parsing JSON, puis throw — le pipeline
 * appelant capture et passe la campagne en `status='error'`.
 */
export async function generateCampaignBrief(
  input: CampaignBriefInput,
): Promise<CampaignBriefResult> {
  const count = Math.max(1, Math.min(6, input.count ?? 3))
  const lang: DetectedLanguage = detectLanguage(input.prompt)

  const dnaLines = buildBrandDnaPromptLines(input.brandKit)
  const brandName = input.brandKit.name ?? 'the brand'
  const colorLine = `Primary brand color: ${input.brandKit.primary_color}${
    input.brandKit.secondary_color ? `, secondary ${input.brandKit.secondary_color}` : ''
  }`

  const productBlock = input.product
    ? `\nFEATURED PRODUCT:\n- Name: ${input.product.name}${
        input.product.description ? `\n- Description: ${input.product.description}` : ''
      }${input.product.category ? `\n- Category: ${input.product.category}` : ''}\nEvery creative MUST relate to this product.`
    : ''

  const assetBlock = input.assetHints && input.assetHints.length > 0
    ? `\nREFERENCE ASSETS (visual mood hints):\n${input.assetHints.slice(0, 5).map((h) => `- ${h}`).join('\n')}`
    : ''

  const systemPrompt = `You are a senior creative director crafting on-brand social media campaign briefs. You reply ONLY with valid JSON. No markdown, no comments.`

  const userPrompt = `Build a campaign brief for "${brandName}".

USER PROMPT:
"""
${input.prompt}
"""

BRAND CONTEXT:
${colorLine}
${dnaLines.join('\n')}${productBlock}${assetBlock}

Produce exactly ${count} creative variations. Each must be visually distinct
yet on-brand. Use the brand's tone of voice in every copy field — header,
description, CTA. Honor the brand aesthetic in every visual_prompt.

Rules:
1. LANGUAGE: every text-facing field (campaign_title, campaign_description,
   header, description, cta) MUST be written in ${lang.name}.
2. The visual_prompt is a detailed instruction for an AI image generator
   (FLUX-class). Always in English, very descriptive (composition, palette,
   light, mood, focal point, style).
3. header is ≤ 60 chars, description is ≤ 140 chars, cta is ≤ 30 chars.
4. campaign_title ≤ 60 chars, campaign_description 1-2 sentences ≤ 240 chars.
5. NEVER mention CLYRO or any other agency in any field — this is the
   brand's campaign, not an ad for the platform.

Reply ONLY with this valid JSON:
{
  "campaign_title": "...",
  "campaign_description": "...",
  "creatives": [
    { "visual_prompt": "...", "header": "...", "description": "...", "cta": "..." }
  ]
}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      logger.info(
        { model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, durationMs: Date.now() - startTime, attempt, creativeCount: count },
        'Claude campaign brief generated',
      )

      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

      const jsonText = content.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const parsed = JSON.parse(jsonText) as Partial<CampaignBriefResult>
      if (!parsed.campaign_title || !parsed.campaign_description || !Array.isArray(parsed.creatives)) {
        throw new Error('Invalid campaign brief shape')
      }

      // Normalise + cap : tronque chaque texte aux limites prévues côté DB
      // pour éviter qu'un dépassement Claude fasse échouer l'insert.
      const creatives: CampaignCreativeBrief[] = parsed.creatives
        .slice(0, count)
        .filter((c): c is CampaignCreativeBrief =>
          !!c && typeof c.visual_prompt === 'string' && typeof c.header === 'string' &&
          typeof c.description === 'string' && typeof c.cta === 'string',
        )
        .map((c) => ({
          visual_prompt: c.visual_prompt.trim().slice(0, 1500),
          header:        c.header.trim().slice(0, 200),
          description:   c.description.trim().slice(0, 500),
          cta:           c.cta.trim().slice(0, 60),
        }))

      if (creatives.length === 0) throw new Error('Empty creatives array')

      return {
        campaign_title:       parsed.campaign_title.trim().slice(0, 160),
        campaign_description: parsed.campaign_description.trim().slice(0, 1000),
        creatives,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn({ attempt, maxRetries: MAX_RETRIES, error: lastError.message }, 'Claude campaign brief attempt failed, retrying')
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(`Campaign brief generation failed: ${lastError?.message ?? 'Unknown error'}`)
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
// ── Polish script — Audit 16/06/26 Wave 3 « Write with AI » ─────────────────

/**
 * Goal of the polish pass — drives the prompt's emphasis:
 *   • tighten   — same meaning, fewer words, cleaner sentences
 *   • punchier  — same meaning, more energetic hook + verbs
 *   • simpler   — same meaning, lower vocabulary, shorter sentences
 *
 * Always preserves the user's intent, CTA, and key concrete facts. Never
 * adds new claims — that's a strict safety constraint so the helper
 * doesn't hallucinate metrics or names.
 */
export type PolishGoal = 'tighten' | 'punchier' | 'simpler'

export interface PolishResult {
  polished_script: string
  original_words:  number
  new_words:       number
}

export async function polishScript(
  script: string,
  language: 'en' | 'fr',
  goal: PolishGoal,
): Promise<PolishResult> {
  const originalWords = script.trim().split(/\s+/).filter(Boolean).length

  // Bilingual prompts — Claude does best when the editorial instructions
  // are in the same language as the target output.
  const systemEn = 'You are a senior copywriter polishing video voiceover scripts. You reply ONLY with the polished script, no quotes, no markdown, no explanation. You preserve the speaker\'s intent, CTA, and every concrete fact (names, numbers, URLs). You never add information that wasn\'t in the original.'
  const systemFr = 'Tu es un copywriter sénior qui polit des scripts de voix off vidéo. Tu réponds UNIQUEMENT avec le script poli, sans guillemets, sans markdown, sans explication. Tu préserves l\'intention du speaker, le CTA et chaque fait concret (noms, chiffres, URLs). Tu n\'ajoutes jamais d\'information absente du texte d\'origine.'

  const goalInstrEn: Record<PolishGoal, string> = {
    tighten:  'Tighten the script: same meaning, fewer words, cleaner sentence flow. Aim for ~15–25% shorter.',
    punchier: 'Make the script punchier: stronger hook in the first 5 seconds, more active verbs, shorter sentences. Same meaning.',
    simpler:  'Simplify the script: shorter sentences, easier vocabulary, accessible to a non-expert reader. Same meaning.',
  }
  const goalInstrFr: Record<PolishGoal, string> = {
    tighten:  'Resserre le script : même sens, moins de mots, phrases plus nettes. Vise ~15–25 % plus court.',
    punchier: 'Rends le script plus percutant : hook plus fort dans les 5 premières secondes, verbes plus actifs, phrases plus courtes. Même sens.',
    simpler:  'Simplifie le script : phrases plus courtes, vocabulaire plus accessible, lisible par un non-expert. Même sens.',
  }

  const system = language === 'fr' ? systemFr : systemEn
  const instruction = (language === 'fr' ? goalInstrFr : goalInstrEn)[goal]

  const userBody = language === 'fr'
    ? `${instruction}

Script original (${originalWords} mots) :
"""
${script}
"""

Réponds uniquement avec le script poli.`
    : `${instruction}

Original script (${originalWords} words):
"""
${script}
"""

Reply with the polished script only.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userBody }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response from Claude polish')

  const polished = content.text.trim()
  const newWords = polished.split(/\s+/).filter(Boolean).length

  logger.info(
    { originalWords, newWords, goal, language },
    'Script polished by Claude',
  )

  return { polished_script: polished, original_words: originalWords, new_words: newWords }
}

/**
 * Condense a voiceover script to fit a target duration. Audit 16/06/26 —
 * was FR-only and would garble EN inputs (system prompt + user content all
 * in French). Now bilingual; caller passes the detected language.
 *
 * Always preserves the user's main message, CTA, and tone. Removes only
 * repetitions, fillers, and secondary details.
 */
// ── Brand DNA inference from URL — Audit 16/06/26 P3.2 ─────────────────────

/**
 * Shape returned to the brand kit pre-fill UI. Every field is nullable
 * so the user can accept partial inferences without the wizard
 * complaining about missing data. The user always reviews + confirms
 * before persistence — this is a SUGGESTION layer, not an autofill.
 */
export interface BrandDNAInference {
  tagline:             string | null
  primary_color:       string | null
  secondary_color:     string | null
  brand_values:        string[]
  brand_aesthetic:     string[]
  brand_tone_of_voice: string[]
  business_overview:   string | null
  /** Detected language code from the page body. */
  language:            'en' | 'fr' | 'es' | 'de' | 'pt'
  /** Source URL after redirect resolution, surfaced to the UI for trust. */
  source_url:          string
  /** Page title extracted from <title>, for context. */
  source_title:        string
}

/**
 * Infer a brand DNA from a public URL. Audit 16/06/26 P3.2 — the audit's
 * « brand DNA inference from URL » opportunity. Combines our SSRF-safe
 * urlExtract scraper with a Sonnet call that maps the visible content
 * to the brand kit schema (tagline, values, aesthetic, tone of voice,
 * business overview, palette suggestion).
 *
 * Safety
 *   • Uses extractArticleFromUrl which has SSRF guards (rejects
 *     localhost / private IPs / metadata services).
 *   • Hard timeout on the scrape via fetchWithLimits.
 *   • Claude is told to NEVER invent business facts not present in the
 *     extracted text — if the page is thin, fields come back null.
 *
 * Returns null fields rather than throwing on partial extractions so
 * the UI can show « we found X, please review and complete the rest ».
 */
export async function inferBrandDNAFromUrl(url: string): Promise<BrandDNAInference> {
  // Lazy import to avoid pulling urlExtract into the bundle of every
  // route that just imports `services/claude` for the MODEL constant.
  const { extractArticleFromUrl } = await import('./urlExtract')
  const article = await extractArticleFromUrl(url)

  // Cap content to ~6 KB to stay well under Claude's context budget and
  // keep latency under 5 s. Most landing pages have their essence in
  // the first kilobyte anyway (hero + tagline + values list).
  const trimmedContent = article.content.length > 6_000
    ? article.content.slice(0, 6_000)
    : article.content

  const langCode = (article.language ?? 'en').slice(0, 2).toLowerCase()
  const lang: BrandDNAInference['language'] = ['en', 'fr', 'es', 'de', 'pt'].includes(langCode)
    ? (langCode as BrandDNAInference['language'])
    : 'en'

  const systemPrompt = `You are a brand strategist analysing a website to extract its brand DNA. You reply ONLY with valid JSON, no markdown, no explanation. You NEVER invent facts that aren't visible in the source text — if a field can't be reliably inferred, set it to null (or an empty array for lists). You preserve the source language for the textual fields (tagline, business_overview).`

  const userPrompt = `Analyse this website and infer the brand DNA. Return the JSON below.

Source URL: ${article.finalUrl}
Page title: ${article.title || '(no title)'}
Page description: ${article.description || '(no description)'}
Detected language: ${lang}

Visible content (trimmed):
"""
${trimmedContent}
"""

Field guidance
- tagline (string | null): a one-line value proposition, ideally ≤ 80 chars, in the source language. Pull from the hero copy if obvious.
- primary_color (#RRGGBB | null): the most prominent brand color you can infer from the copy (e.g. « emerald-green sustainability », « midnight-blue trust »). Output uppercase 6-digit hex. Null if no strong signal.
- secondary_color (#RRGGBB | null): a complementary accent, same rule.
- brand_values (string[] ≤ 5): short noun phrases (1–2 words each) extracted from the page's stated values, mission, or repeated themes. Empty array if nothing clear.
- brand_aesthetic (string[] ≤ 4): visual / stylistic descriptors (« minimal », « editorial », « playful », « industrial »). Inferred from the writing tone since you can't see the design.
- brand_tone_of_voice (string[] ≤ 4): tone adjectives (« authoritative », « warm », « technical », « provocative »).
- business_overview (string ≤ 200 chars | null): a single concise sentence describing what the business does. Source-language.

Reply ONLY with this JSON:
{
  "tagline": "...",
  "primary_color": "#RRGGBB",
  "secondary_color": "#RRGGBB",
  "brand_values": ["...", "..."],
  "brand_aesthetic": ["...", "..."],
  "brand_tone_of_voice": ["...", "..."],
  "business_overview": "..."
}`

  const message = await withClaudeRetry(
    () => client.messages.create({
      model: MODEL, // Sonnet — the user pays 5 credits for this, quality matters
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    'inferBrandDNAFromUrl',
  )

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude (brand DNA)')
  }

  const jsonText = content.text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim()

  const parsed = JSON.parse(jsonText) as Record<string, unknown>

  // Defensive normalisation — Claude is told to follow the shape but
  // anything that escapes our prompt should be clamped here.
  function asString(v: unknown, maxLen: number): string | null {
    if (typeof v !== 'string' || !v.trim()) return null
    return v.trim().slice(0, maxLen)
  }
  function asHex(v: unknown): string | null {
    if (typeof v !== 'string') return null
    const trimmed = v.trim()
    return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : null
  }
  function asArrayOfStr(v: unknown, maxItems: number, maxLen: number): string[] {
    if (!Array.isArray(v)) return []
    return v
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim().slice(0, maxLen))
      .slice(0, maxItems)
  }

  const result: BrandDNAInference = {
    tagline:             asString(parsed.tagline, 200),
    primary_color:       asHex(parsed.primary_color),
    secondary_color:     asHex(parsed.secondary_color),
    brand_values:        asArrayOfStr(parsed.brand_values, 5, 40),
    brand_aesthetic:     asArrayOfStr(parsed.brand_aesthetic, 4, 30),
    brand_tone_of_voice: asArrayOfStr(parsed.brand_tone_of_voice, 4, 30),
    business_overview:   asString(parsed.business_overview, 400),
    language:            lang,
    source_url:          article.finalUrl,
    source_title:        article.title,
  }

  logger.info(
    {
      url: article.finalUrl,
      gotTagline: !!result.tagline,
      gotPrimary: !!result.primary_color,
      values:     result.brand_values.length,
      aesthetic:  result.brand_aesthetic.length,
      tone:       result.brand_tone_of_voice.length,
    },
    'Brand DNA inferred from URL',
  )

  return result
}

// ── Pre-flight script quality check — Audit 16/06/26 P3.3 ──────────────────

/**
 * Categories of issues we flag. Stable enum so the frontend can map each
 * issue type to a translated label / icon. Severities are advisory:
 *   • warning — likely to hurt the final video; user should consider fixing
 *   • info    — stylistic nudge; user can ignore
 */
export type ScriptIssueType =
  | 'weak_cta'        // no clear ask at the end
  | 'slow_hook'       // first 5 seconds don't grab attention
  | 'repetition'      // same idea repeated / filler words
  | 'vague_language'  // « very », « a lot », « really » overload
  | 'too_short'       // < 30 words — probably not a real script
  | 'too_long'        // > 500 words — too long for short-form

export interface ScriptIssue {
  type:        ScriptIssueType
  severity:    'warning' | 'info'
  message:     string
  /** Optional concrete rewrite suggestion. */
  suggestion?: string
}

export interface ScriptCheckResult {
  issues:        ScriptIssue[]
  /** Detected language code from the script body. */
  language:      'en' | 'fr'
  /** Word count of the input, surfaced for the UI cost estimate. */
  word_count:    number
}

/**
 * Run a cheap pre-flight pass over a script and return concrete issues the
 * user might want to fix before paying for a full Claude storyboard
 * generation. Cost ~250 tokens × Haiku 4.5 → effectively free per call,
 * gives the user a real reason to trust the helper.
 *
 * Safety constraint: the helper NEVER rewrites the script — it only flags
 * and (optionally) suggests. The user keeps full editorial control.
 */
export async function checkScript(
  script: string,
  language: 'en' | 'fr' = 'en',
): Promise<ScriptCheckResult> {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length

  // Deterministic guards — no Claude call needed for the length checks.
  const guardIssues: ScriptIssue[] = []
  if (wordCount < 30) {
    guardIssues.push({
      type:     'too_short',
      severity: 'warning',
      message:  language === 'fr'
        ? 'Trop court — le storyboard ne pourra pas couvrir tout le sens.'
        : 'Too short — the storyboard can\'t carry meaning at this length.',
    })
    return { issues: guardIssues, language, word_count: wordCount }
  }
  if (wordCount > 500) {
    guardIssues.push({
      type:     'too_long',
      severity: 'info',
      message:  language === 'fr'
        ? 'Très long — vise plutôt 200–400 mots pour le format court.'
        : 'Quite long — aim for 200–400 words for short-form video.',
    })
    // Don't return — Claude can still flag other issues.
  }

  const systemEn = 'You are a script editor reviewing voiceover scripts. Reply ONLY with valid JSON, no markdown, no explanation.'
  const systemFr = 'Tu es un éditeur de script qui audite des scripts de voix off. Tu réponds UNIQUEMENT avec du JSON valide, sans markdown, sans explication.'

  const userEn = `Inspect this voiceover script and flag at most 4 concrete issues. Allowed issue types: "weak_cta", "slow_hook", "repetition", "vague_language". For each, set severity to "warning" (will hurt the video) or "info" (stylistic). Include a short message (≤ 100 chars) and, when actionable, a concrete suggestion (≤ 120 chars). NEVER rewrite the script. NEVER add issue types not in the allowed list.

Script:
"""
${script}
"""

Reply ONLY with this JSON:
{ "issues": [ { "type": "...", "severity": "warning"|"info", "message": "...", "suggestion": "..." } ] }`

  const userFr = `Examine ce script de voix off et signale AU MAX 4 problèmes concrets. Types autorisés : « weak_cta », « slow_hook », « repetition », « vague_language ». Pour chacun, severity à « warning » (gênant) ou « info » (stylistique). Inclus un message court (≤ 100 chars) et, si possible, une suggestion concrète (≤ 120 chars). N'écris JAMAIS un nouveau script. N'ajoute JAMAIS de type hors de la liste autorisée.

Script :
"""
${script}
"""

Réponds UNIQUEMENT avec ce JSON :
{ "issues": [ { "type": "...", "severity": "warning"|"info", "message": "...", "suggestion": "..." } ] }`

  try {
    const message = await withClaudeRetry(
      () => client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 600,
        system: language === 'en' ? systemEn : systemFr,
        messages: [{ role: 'user', content: language === 'en' ? userEn : userFr }],
      }),
      'checkScript',
    )

    const content = message.content[0]
    if (content.type !== 'text') return { issues: guardIssues, language, word_count: wordCount }

    const jsonText = content.text
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()

    const allowedTypes: ReadonlyArray<ScriptIssueType> = [
      'weak_cta', 'slow_hook', 'repetition', 'vague_language',
    ]
    const parsed = JSON.parse(jsonText) as { issues?: unknown }
    const claudeIssues: ScriptIssue[] = []
    if (Array.isArray(parsed.issues)) {
      for (const raw of parsed.issues.slice(0, 4)) {
        if (!raw || typeof raw !== 'object') continue
        const r = raw as Record<string, unknown>
        const type = r.type as ScriptIssueType
        if (!allowedTypes.includes(type)) continue
        const severity = r.severity === 'warning' || r.severity === 'info' ? r.severity : 'info'
        const messageText = typeof r.message === 'string' ? r.message.slice(0, 200) : ''
        if (!messageText) continue
        const suggestion = typeof r.suggestion === 'string' ? r.suggestion.slice(0, 200) : undefined
        claudeIssues.push({ type, severity, message: messageText, suggestion })
      }
    }

    logger.info({ wordCount, issuesCount: claudeIssues.length, language }, 'Script checked by Claude')
    return { issues: [...guardIssues, ...claudeIssues], language, word_count: wordCount }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'checkScript failed — returning guard issues only',
    )
    return { issues: guardIssues, language, word_count: wordCount }
  }
}

export async function condenseScript(
  script: string,
  targetDuration: string,
  language: 'en' | 'fr' = 'fr',
): Promise<CondenseResult> {
  const targetSeconds = DURATION_SECONDS[targetDuration] ?? 30
  const maxWords = Math.floor((targetSeconds / 60) * WPM_FR)
  const originalWordCount = script.trim().split(/\s+/).filter(Boolean).length

  const systemFr = 'Tu es un copywriter expert. Tu condenses des scripts vidéo en préservant les messages clés. Tu réponds UNIQUEMENT avec le script condensé, sans explication, sans guillemets, sans markdown.'
  const systemEn = 'You are a senior copywriter. You condense voiceover scripts while preserving the key messages. You reply ONLY with the condensed script — no explanation, no quotes, no markdown.'

  const userFr = `Condense ce script de voix off en MAXIMUM ${maxWords} mots (durée cible : ${targetSeconds}s à 150 mots/min).
Préserve : le message principal, le CTA, le ton. Supprime : répétitions, formulations longues, détails secondaires.

Script original (${originalWordCount} mots) :
"""
${script}
"""

Réponds uniquement avec le script condensé.`

  const userEn = `Condense this voiceover script to AT MOST ${maxWords} words (target duration: ${targetSeconds}s at 150 words/min).
Preserve: the main message, the CTA, the tone. Drop: repetitions, long-winded phrasing, secondary details.

Original script (${originalWordCount} words):
"""
${script}
"""

Reply with the condensed script only.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: language === 'en' ? systemEn : systemFr,
    messages: [{
      role: 'user',
      content: language === 'en' ? userEn : userFr,
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response from Claude condense')

  const condensedScript = content.text.trim()
  const condensedWordCount = condensedScript.split(/\s+/).filter(Boolean).length

  logger.info(
    { originalWordCount, condensedWordCount, targetSeconds, maxWords, language },
    'Script condensed by Claude'
  )

  return { condensedScript, originalWordCount, condensedWordCount }
}
