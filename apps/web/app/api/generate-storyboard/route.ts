import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import {
  detectLanguage,
  getStyleVisualGuide,
  type DetectedLanguage,
} from '@clyro/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ── Scene-count heuristic ────────────────────────────────────────────────
// 22 words/scene ≈ 8-9s narration at 150 wpm.
// Token budget: model outputs 8192 tokens. Each scene ≈ 80 tokens (concise
// descriptions). Safe ceiling ≈ 100; we cap at 60 for structural overhead.
const WPM = 150
const WORDS_PER_SCENE = 22
const MAX_SCENES = 60

function computeAutoSceneCount(script: string): { sceneCount: number; estimatedSeconds: number } {
  const words = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = Math.max(6, Math.round((words / WPM) * 60))
  const sceneCount = Math.max(3, Math.min(MAX_SCENES, Math.ceil(words / WORDS_PER_SCENE)))
  return { sceneCount, estimatedSeconds }
}

// ── Language header — same shape as apps/api/src/services/claude.ts ──────
// Stating the target language as the FIRST thing in CAPS in the prompt
// body breaks Claude's tendency to mirror the prompt's own language
// (which used to default to French and silently translate scripts).
function languageHeader(lang: DetectedLanguage): string {
  return `OUTPUT LANGUAGE — STRICT
All narration text and on-screen copy fields (texte_voix, display_text, etc.) MUST be written in ${lang.name} (${lang.code}).
This is non-negotiable. Do NOT translate to French, English, or any other language regardless of the language used elsewhere in these instructions. The visual prompt fields (description_visuelle, animation_prompt) remain in English because downstream image/video models only understand English.

`
}

function buildStoryboardPrompts(p: {
  script:      string
  style:       string
  duration:    string
  title?:      string
  description?: string
  language:    DetectedLanguage
}): { system: string; user: string } {
  const isAuto = p.duration === 'auto'
  const auto = computeAutoSceneCount(p.script)
  const sceneCount = auto.sceneCount
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

You reply ONLY with valid JSON, no markdown, no comments.`

  const durationInstruction = isAuto
    ? `4. The total duration must FAITHFULLY reflect the script length (~${WPM} wpm spoken). Do NOT condense, do NOT shorten — every sentence is narrated in full.\n5. Sum of duree_estimee should be coherent with the script length (~${auto.estimatedSeconds}s estimated). Adjust naturally per scene.`
    : `4. The total duration must FAITHFULLY reflect the script length (~${WPM} wpm spoken). Do NOT condense — every sentence is narrated in full.\n5. Sum of duree_estimee should be coherent with the script length (~${auto.estimatedSeconds}s estimated). Adjust naturally per scene.`

  const user = `${languageHeader(lang)}Break this script into roughly ${sceneCount} visual scenes for a "${p.style}" style video.${p.title ? `\nTitle: "${p.title}"` : ''}
${p.description ? `\nVISUAL CONTEXT (characters, setting, mood):\n${p.description}\n→ Integrate these elements into description_visuelle when relevant (skin tone, clothing, setting).` : ''}
${hasDialogue ? `\nDIALOGUE MODE DETECTED: the script contains dialogue between multiple characters.\nSPECIAL RULES:\n- Detect each speaker in the script\n- Every line MUST include a "speaker" field with the character's name\n- Alternating dialogues → create separate scenes per speaker\n- description_visuelle MUST include all visible characters in the scene` : ''}

REQUIRED VISUAL STYLE for description_visuelle: ${styleGuide}

For each scene, produce:
- "index": scene number (starts at 0)
- "description_visuelle": visual prompt in ENGLISH for Flux (max 150 chars). MUST follow the visual style above. Describe ONLY the unique visual content of this scene — WHO is visible, WHAT happens, WHERE. Each scene must be visually distinct. Never include identifiable real people.
- "animation_prompt": camera/motion prompt in ENGLISH for image-to-video (max 80 chars). Describes a concrete visible movement, e.g. "slow zoom in, character gestures forward, subtle breathing motion".
- "texte_voix": REQUIRED — narration written in ${lang.name} (the script's language). NEVER translate. Always filled, never empty. Matches the corresponding portion of the script verbatim.
- "duree_estimee": duration in seconds (integer, between 3 and 12)
${hasDialogue ? `- "speaker": NAME of the speaking character. Optional for narration, REQUIRED for dialogue lines.` : ''}

RULES:
1. description_visuelle = unique visual content per scene (subject + action + setting). MUST follow the visual style. Good examples: "scientist examining glowing DNA strand in dark lab", "crowd celebrating in sunlit city square". Bad: "smooth animation" or generic shots.
2. animation_prompt MUST describe a CONCRETE motion (never just "smooth animation").
3. texte_voix is REQUIRED — distribute the full script across all scenes, in ${lang.name}, omitting nothing.
${durationInstruction}
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
}

function extractJson(raw: string): { scenes: SceneObject[]; total_duration: number } {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*/)
  if (!match) throw new Error('No JSON found in Claude response')
  const partial = match[0]

  // 1. Try clean parse first
  try {
    const full = partial.match(/\{[\s\S]*\}/)
    if (full) return JSON.parse(full[0])
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

    // Detect script language so the storyboard's texte_voix preserves it
    // instead of silently translating to French (regression seen in prod).
    const language = detectLanguage(script)

    const { system, user } = buildStoryboardPrompts({
      script, style, duration, title, description, language,
    })

    // Use sonnet-4-6 for quality (haiku-4-5 was producing thinner prompts
    // and worse image generation results — observed regression).
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = extractJson(raw)

    if (!Array.isArray(parsed.scenes)) throw new Error('Invalid storyboard: missing scenes array')

    return NextResponse.json({
      scenes:         parsed.scenes,
      total_duration: parsed.total_duration,
      language:       language.code,
    })
  } catch (err) {
    console.error('[generate-storyboard]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Storyboard generation failed', code: 'GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
