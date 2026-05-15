import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import {
  detectLanguage,
  getStyleVisualGuide,
  planSceneCount,
  splitScriptForChunks,
  validateScriptCoverage,
  countWords,
  STORYBOARD_WPM,
  STORYBOARD_SANITY_LIMIT,
  type DetectedLanguage,
} from '@clyro/shared'

export const dynamic = 'force-dynamic'
// Long scripts → multiple Claude calls in parallel. 5 min covers ~12000-word
// scripts (≈ 80 min of video) at typical Sonnet 4.6 latency (~25 s/chunk).
export const maxDuration = 300

// ── Anthropic output budget ────────────────────────────────────────────────
// Sonnet 4.6 supports up to 64 000 output tokens. We cap each call at 16 000
// for latency / cost balance and rely on chunked generation for very long
// scripts (see STORYBOARD_MAX_SCENES_PER_CALL in shared/script-planning.ts).
const MAX_OUTPUT_TOKENS = 16_000

// ── Language header — same shape as apps/api/src/services/claude.ts ──────
// Stating the target language as the FIRST thing in CAPS in the prompt
// body breaks Claude's tendency to mirror the prompt's own language.
function languageHeader(lang: DetectedLanguage): string {
  return `OUTPUT LANGUAGE — STRICT
All narration text and on-screen copy fields (texte_voix, display_text, etc.) MUST be written in ${lang.name} (${lang.code}).
This is non-negotiable. Do NOT translate to French, English, or any other language regardless of the language used elsewhere in these instructions. The visual prompt fields (description_visuelle, animation_prompt) remain in English because downstream image/video models only understand English.

`
}

interface BuildPromptParams {
  script:        string
  style:         string
  duration:      string
  title?:        string
  description?:  string
  language:      DetectedLanguage
  sceneCount:    number     // # de scènes pour CE chunk précisément
  estimatedSeconds: number  // durée totale du chunk (pas du script entier)
  startIndex:    number     // index global de départ pour ce chunk
  isChunked:     boolean    // true si le script est découpé en plusieurs chunks
  chunkPosition?: { current: number; total: number } // position du chunk dans le script
}

function buildStoryboardPrompts(p: BuildPromptParams): { system: string; user: string } {
  const styleGuide = getStyleVisualGuide(p.style)
  const lang = p.language

  const scriptLines = p.script.split('\n')
  const hasDialogue = scriptLines.some((l) =>
    /^—|^–/.test(l.trim()) ||
    /^[A-ZÀ-Ü][a-zà-ü]+\s*:/.test(l.trim()) ||
    /["«].*["»]/.test(l.trim())
  )

  const system = `You are an expert video producer and visual storyteller.
You generate precise, professional storyboards for faceless videos (no on-camera presenter).

CRITICAL RULE — Text inside the image:
Diffusion models (Flux, Ideogram) cannot reliably render readable text.
→ Specific numbers, stats, titles, quotes and CTAs are rendered later as drawtext overlays.
→ "description_visuelle" only describes the visual scene (subject + action + setting).
  Each scene must be visually distinct from the others.

CRITICAL RULE — Script preservation (NON-NEGOTIABLE):
The user's script MUST be preserved VERBATIM across the texte_voix fields.
→ Do NOT condense, do NOT summarize, do NOT skip any sentence.
→ The concatenation of all texte_voix fields, in order, MUST reconstruct the original script exactly (modulo whitespace).
→ The video's duration is determined ENTIRELY by the script's length. There is no upper limit.
→ If the script is long, produce many scenes. If it's short, produce few. Always full coverage.

You reply ONLY with valid JSON, no markdown, no comments.`

  const chunkContext = p.isChunked && p.chunkPosition
    ? `\nCHUNK ${p.chunkPosition.current}/${p.chunkPosition.total}: this is part of a longer script. Generate ONLY the scenes for the script excerpt below — the rest is handled by parallel calls. Scene indices in this chunk start at ${p.startIndex}.`
    : ''

  const user = `${languageHeader(lang)}Break this script into approximately ${p.sceneCount} visual scenes for a "${p.style}" style video.${p.title ? `\nTitle: "${p.title}"` : ''}${chunkContext}
${p.description ? `\nVISUAL CONTEXT (characters, setting, mood):\n${p.description}\n→ Integrate these elements into description_visuelle when relevant (skin tone, clothing, setting).` : ''}
${hasDialogue ? `\nDIALOGUE MODE DETECTED: the script contains dialogue between multiple characters.\nSPECIAL RULES:\n- Detect each speaker in the script\n- Every line MUST include a "speaker" field with the character's name\n- Alternating dialogues → create separate scenes per speaker\n- description_visuelle MUST include all visible characters in the scene` : ''}

REQUIRED VISUAL STYLE for description_visuelle: ${styleGuide}

For each scene, produce:
- "index": scene number (starts at ${p.startIndex})
- "description_visuelle": visual prompt in ENGLISH for Flux (60–120 words, max 500 chars). MUST follow the MEANINGFUL IMAGE RULES below and the visual style above. The image must ILLUSTRATE THE SPECIFIC CONCEPT being discussed — not the mood, not the niche. If the viewer mutes the video, they should understand what this scene is about from the image alone. Each scene must be visually distinct. Never include identifiable real people.
- "animation_prompt": camera/motion prompt in ENGLISH for image-to-video (max 80 chars). Describes ONE primary subject motion + ONE camera move, ending with "smooth cinematic motion".
- "texte_voix": REQUIRED — narration written in ${lang.name} (the script's language). NEVER translate. Always filled, never empty. Matches the corresponding portion of the script VERBATIM. Cumulatively across all scenes, every word of the script MUST appear.
- "duree_estimee": duration in seconds (integer, between 3 and 12). Sum across all scenes ≈ ${p.estimatedSeconds}s (~${STORYBOARD_WPM} wpm narration of the script). Adjust naturally per scene based on the length of its texte_voix.
- "faceless_scene_type": one of "broll" | "infographic" | "typography" | "demo". Pick the template that fits this scene's purpose:
    • "broll"       — narrative atmospheric scene (no overlay, or a key_phrase / source). Rich detailed image, full frame.
    • "infographic" — scene illustrating a number / stat / comparison. Backdrop is a SILENT chart with negative space in the CENTER for the overlay.
    • "typography"  — scene where the headline / key_phrase IS the content. Minimal / abstract backdrop with full-frame negative space.
    • "demo"        — scene about an interface, app or product. Image is a clean mockup with focused subject.
- "overlay" (OPTIONAL): one object { type, text, position?, trigger_word?, duration_seconds? } with type ∈ stat | headline | key_phrase | comparison | list_item | source | cta. Use stat for any number, headline for section starts, key_phrase for the most quotable line, comparison for "A | B" contrasts, list_item for "#3 — TOPIC" lists, source for citations, cta for closing call-to-action. text stays in ${lang.name}. trigger_word = the word from texte_voix that triggers it.
${hasDialogue ? `- "speaker": NAME of the speaking character. Optional for narration, REQUIRED for dialogue lines.` : ''}

═══════════════════════════════════════════════════════════════════════
MEANINGFUL IMAGE RULES for description_visuelle:

CORE PRINCIPLE: The image must make the viewer UNDERSTAND the concept
without hearing the narration. Decorative images = viewer leaves.

STRUCTURE (mandatory order):
  1. CONCEPT     — choose a technique from the 7 TYPES below that best illustrates the SPECIFIC idea
  2. DETAILS     — include specific objects, numbers, textures, wear marks that make the scene real and concrete
  3. ENVIRONMENT — background, spatial context, negative space for overlays if needed
  4. LIGHTING    — direction, temperature, emotional match (serious=dramatic dark, positive=warm golden, warning=cold red accents)
  5. TECHNICAL   — camera/lens/finish (e.g. "shot on Canon R5, 85mm, shallow DoF, 8K")

7 TECHNIQUES — use in order of preference:
  1. VISUAL METAPHOR — translate abstract concept into a physical object/scene
     (compound interest = tiny seedling next to massive oak tree with coins at their bases)
  2. SIDE-BY-SIDE COMPARISON — show contrast between two states in one frame
     (cluttered desk with fast food vs clean minimal desk with notebook, split composition)
  3. STORYTELLING OBJECT — one close-up object that embodies the concept with SPECIFIC details
     (empty wallet next to $2,400 repair invoice, phone showing $47.23 bank balance)
  4. SIMPLIFIED DIAGRAM — icons or objects arranged to show a process/cycle
     (four glowing icons in a circle connected by gradient arrows showing a loop)
  5. RECOGNIZABLE SITUATION — a specific everyday moment with precise details
     (phone in bed at 1:47 AM, battery at 12%, scroll indicator showing deep into feed)
  6. TEMPORAL PROGRESSION — left-to-right evolution showing change over time
     (row of 5 glass jars from few coins to overflowing, subtle year labels beneath)
  7. PHYSICAL DATA — make numbers tangible as physical objects
     (100 gray figurines in a grid, only 3 painted gold = "97% never build wealth")

BANNED GENERIC IMAGES — NEVER generate these:
  ✗ Sunsets, sunrises, beaches (unless the script is literally about them)
  ✗ Person walking on a road toward the horizon
  ✗ Abstract particles, glowing orbs, or meaningless light effects
  ✗ Generic city skyline at night
  ✗ Person at a desk "being productive" with no specific details
  ✗ Abstract brain visualization with no specific mechanism shown
  ✗ Generic piggy bank, clock, hourglass, or lightbulb without a specific story

DETAIL REQUIREMENTS — every prompt MUST include:
  • Specific visible quantities when the script mentions numbers
  • Specific object states (cracked, worn, overflowing, empty, fraying)
  • Specific spatial relationships that tell the story (small vs large, empty vs full, broken vs intact)

NEVER mention identifiable real people — use hands, silhouettes, objects, abstract shapes.
End every prompt with "8K".

Adapt to faceless_scene_type:
  • broll       → rich narrative scene using techniques 1-3 or 5 above, no negative-space request
  • infographic → technique 4 or 7 + "negative space in the CENTER for text overlay"
  • typography  → minimal abstract surface with single metaphorical object + "full-frame negative space for centered text"
  • demo        → clean device or interface mockup, focused subject, soft ambient light
═══════════════════════════════════════════════════════════════════════

RULES:
1. description_visuelle = CONCEPT-DRIVEN visual content per scene. Ask: "Can someone guess what the script discusses from this image alone?" If no, rewrite. MUST follow the visual style.
2. animation_prompt MUST describe a CONCRETE motion (never just "smooth animation").
3. texte_voix is REQUIRED — distribute the full script across ALL scenes verbatim, in ${lang.name}, omitting NOTHING. Every sentence of the script must appear in some scene.
4. The total duration must FAITHFULLY reflect the script length (~${STORYBOARD_WPM} wpm spoken). Do NOT condense, do NOT shorten — every sentence is narrated in full.
5. The number of scenes adapts to the script length. ${p.sceneCount} is a target, not a hard limit — adjust ±20% if needed to keep each texte_voix natural (one full thought per scene).
${hasDialogue ? `6. DIALOGUES: when two characters speak in succession, prefer separate scenes per line (lets the renderer use different voices)` : ''}

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

type SceneObject = {
  index:               number
  description_visuelle: string
  animation_prompt:     string
  texte_voix:           string
  duree_estimee:        number
  speaker?:             string
  faceless_scene_type?: string
  overlay?:             unknown
}

interface ParsedStoryboard {
  scenes: SceneObject[]
  total_duration: number
}

function extractJson(raw: string): ParsedStoryboard {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*/)
  if (!match) throw new Error('No JSON found in Claude response')
  const partial = match[0]

  // 1. Try clean parse first
  try {
    const full = partial.match(/\{[\s\S]*\}/)
    if (full) return JSON.parse(full[0]) as ParsedStoryboard
  } catch { /* fall through to recovery */ }

  // 2. JSON was truncated — extract every complete scene object individually
  const scenes: SceneObject[] = []
  const re = /\{[^{}]*"index"\s*:\s*(\d+)[^{}]*\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(partial)) !== null) {
    try {
      const obj = JSON.parse(m[0]) as SceneObject
      if (obj.texte_voix && obj.description_visuelle) scenes.push(obj)
    } catch { /* skip malformed object */ }
  }
  if (scenes.length === 0) throw new Error('Could not recover any scenes from truncated response')
  const total_duration = scenes.reduce((s, sc) => s + (sc.duree_estimee || 5), 0)
  return { scenes, total_duration }
}

/**
 * Génère un storyboard pour UN chunk de script. Appelée en parallèle
 * pour chaque chunk quand le script est long.
 */
async function generateChunkStoryboard(
  anthropic: Anthropic,
  params: BuildPromptParams,
): Promise<ParsedStoryboard> {
  const { system, user } = buildStoryboardPrompts(params)
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  return extractJson(raw)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const body = await request.json() as {
      script: string; style: string; duration?: string; title?: string; description?: string
    }
    const { script, style, duration = 'auto', title, description } = body

    if (!script || !style) {
      return NextResponse.json({ error: 'script and style are required' }, { status: 400 })
    }

    // ── Plan: word count → scene count → chunk count (no caps) ──────────
    // Le script ne doit JAMAIS être raccourci. La durée de la vidéo est
    // entièrement déterminée par le nombre de mots du script.
    const language = detectLanguage(script)
    const plan = planSceneCount(script, duration)

    if (plan.sceneCount > STORYBOARD_SANITY_LIMIT) {
      console.warn(
        `[generate-storyboard] very long script: ${plan.wordCount} words → ${plan.sceneCount} scenes (over sanity limit ${STORYBOARD_SANITY_LIMIT}) — generating anyway as user requested no script truncation`,
      )
    }

    const anthropic = new Anthropic({ apiKey })

    // ── Single-call path (short scripts) ─────────────────────────────
    if (plan.chunkCount === 1) {
      const parsed = await generateChunkStoryboard(anthropic, {
        script,
        style,
        duration,
        title,
        description,
        language,
        sceneCount:        plan.sceneCount,
        estimatedSeconds:  plan.estimatedSeconds,
        startIndex:        0,
        isChunked:         false,
      })

      if (!Array.isArray(parsed.scenes)) throw new Error('Invalid storyboard: missing scenes array')

      const coverage = validateScriptCoverage(script, parsed.scenes)
      if (!coverage.ok) {
        console.warn(
          `[generate-storyboard] script coverage low: ${coverage.storyboardWords}/${coverage.originalWords} words (${coverage.lossPercent}% loss) — Claude may have compressed the script`,
        )
      }

      return NextResponse.json({
        scenes:         parsed.scenes,
        total_duration: parsed.total_duration,
        language:       language.code,
        coverage,
      })
    }

    // ── Multi-chunk path (long scripts) ──────────────────────────────
    // Découpe le script en plusieurs morceaux, génère un storyboard par
    // morceau en parallèle, puis ré-indexe et concatène.
    const scriptChunks = splitScriptForChunks(script, plan.chunkCount)
    const actualChunkCount = scriptChunks.length

    // Précompute startIndex + sceneCount per chunk (proportionnel au nb de mots)
    const chunkPlans = scriptChunks.map((chunk, i) => {
      const chunkPlan = planSceneCount(chunk, 'auto')
      return {
        chunk,
        sceneCount:       chunkPlan.sceneCount,
        estimatedSeconds: chunkPlan.estimatedSeconds,
        position:         i,
      }
    })
    let runningIndex = 0
    const startIndices = chunkPlans.map((cp) => {
      const start = runningIndex
      runningIndex += cp.sceneCount
      return start
    })

    const chunkResults = await Promise.all(
      chunkPlans.map((cp, i) => generateChunkStoryboard(anthropic, {
        script:           cp.chunk,
        style,
        duration,
        title,
        description,
        language,
        sceneCount:       cp.sceneCount,
        estimatedSeconds: cp.estimatedSeconds,
        startIndex:       startIndices[i],
        isChunked:        true,
        chunkPosition:    { current: i + 1, total: actualChunkCount },
      })),
    )

    // Merge: re-number indices to be globally sequential and contiguous
    let globalIndex = 0
    const mergedScenes: SceneObject[] = []
    for (const result of chunkResults) {
      for (const scene of (result.scenes ?? []).sort((a, b) => a.index - b.index)) {
        mergedScenes.push({ ...scene, index: globalIndex })
        globalIndex += 1
      }
    }
    const totalDuration = mergedScenes.reduce((s, sc) => s + (sc.duree_estimee || 5), 0)

    const coverage = validateScriptCoverage(script, mergedScenes)
    if (!coverage.ok) {
      console.warn(
        `[generate-storyboard] chunked coverage low: ${coverage.storyboardWords}/${coverage.originalWords} words (${coverage.lossPercent}% loss across ${actualChunkCount} chunks)`,
      )
    }

    console.info(
      `[generate-storyboard] chunked OK: ${plan.wordCount} words → ${mergedScenes.length} scenes across ${actualChunkCount} parallel calls (${countWords(script)} → ${coverage.storyboardWords} words preserved)`,
    )

    return NextResponse.json({
      scenes:         mergedScenes,
      total_duration: totalDuration,
      language:       language.code,
      coverage,
      chunked:        true,
      chunk_count:    actualChunkCount,
    })
  } catch (err) {
    console.error('[generate-storyboard]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Storyboard generation failed', code: 'GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
