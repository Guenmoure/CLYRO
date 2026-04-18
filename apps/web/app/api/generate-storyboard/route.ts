import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ── Style guides (must match apps/api/src/prompts/index.ts) ──────────────────
const STYLE_VISUAL_GUIDE: Record<string, string> = {
  'cinematique':     'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain',
  'stock-vo':        'realistic photograph, natural light, documentary style, Canon 5D',
  'whiteboard':      'hand-drawn whiteboard sketch, black marker on white background, educational illustration',
  'stickman':        'RSA Animate whiteboard illustration, black marker stick figures and simple geometric shapes on plain white background, expressive line drawing, no fills, no color',
  'flat-design':     'flat vector illustration, bold solid colors, geometric shapes, material design style',
  'infographie':     'flat infographic illustration, data visualization icons, bold colors',
  '3d-pixar':        '3D Pixar animation style, subsurface scattering, warm lighting, expressive characters',
  'minimaliste':     'minimalist design, clean white background, geometric shapes, Bauhaus style',
  'motion-graphics': 'motion graphics design, abstract geometric shapes, gradient colors, After Effects style',
  'animation-2d':    'cartoon 2D flat animation, vibrant colors, expressive characters, anime-influenced',
  'corporate':       'clean corporate illustration, professional, navy blue, business context',
  'dynamique':       'high-energy composition, neon accents, dark background, sports action',
  'luxe':            'luxury brand photography, gold and black palette, bokeh, marble surfaces',
  'fun':             'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti',
}

const WPM_FR = 150
// 35 words/scene ≈ 14s at 150 wpm — keeps output well under 8192 tokens even for long scripts.
// With 8192 tokens and ~200 chars/scene (50 tokens), the hard cap is ~160 scenes.
// We limit to 20 to keep quality high and generation fast.
const WORDS_PER_SCENE = 35
const MAX_SCENES = 20

function computeAutoSceneCount(script: string): { sceneCount: number; estimatedSeconds: number } {
  const words = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = Math.max(6, Math.round((words / WPM_FR) * 60))
  const sceneCount = Math.max(3, Math.min(MAX_SCENES, Math.ceil(words / WORDS_PER_SCENE)))
  return { sceneCount, estimatedSeconds }
}

function buildStoryboardPrompts(p: {
  script: string; style: string; duration: string; title?: string; description?: string
}): { system: string; user: string } {
  const isAuto = p.duration === 'auto'
  const auto = computeAutoSceneCount(p.script)
  const sceneCount = auto.sceneCount
  const styleGuide = STYLE_VISUAL_GUIDE[p.style] ?? 'professional visual composition'
  const scriptLines = p.script.split('\n')
  const hasDialogue = scriptLines.some((l) =>
    /^—|^–/.test(l.trim()) ||
    /^[A-ZÀ-Ü][a-zà-ü]+\s*:/.test(l.trim()) ||
    /["«].*["»]/.test(l.trim())
  )

  const system = `Tu es un expert en production vidéo et en storytelling visuel.\nTu génères des storyboards précis et professionnels pour des vidéos sans présentateur.\nTu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`

  const durationInstruction = isAuto
    ? `4. La durée totale doit refléter FIDÈLEMENT la longueur réelle du script (~150 mots/minute à voix haute). Ne condense PAS, ne raccourcis PAS — chaque phrase du script est narrée en entier.\n5. La somme des duree_estimee doit être cohérente avec la longueur du script (~${auto.estimatedSeconds}s estimé). Ajuste naturellement scène par scène.`
    : `4. La durée totale doit refléter FIDÈLEMENT la longueur réelle du script (~150 mots/minute à voix haute). Ne condense PAS — chaque phrase est narrée en entier.\n5. La somme des duree_estimee doit être cohérente avec la longueur du script (~${auto.estimatedSeconds}s estimé). Ajuste naturellement scène par scène.`

  const user = `Découpe ce script en environ ${sceneCount} scènes visuelles pour une vidéo de style "${p.style}".${p.title ? `\nTitre : "${p.title}"` : ''}
${p.description ? `\nCONTEXTE VISUEL (personnages, décor, ambiance) :\n${p.description}\n→ Intègre ces éléments dans description_visuelle lorsque pertinent (couleur de peau, style vestimentaire, décor).` : ''}
${hasDialogue ? `\nMODE DIALOGUE DÉTECTÉ : Le script contient des dialogues entre plusieurs personnages.\nINSTRUCTIONS SPÉCIALES :\n- Détecte chaque personnage / locuteur dans le script\n- Chaque réplique DOIT inclure un champ "speaker" avec le nom du personnage\n- Si dialogues alternés → crée des scènes séparées par locuteur\n- La description_visuelle DOIT inclure TOUS les personnages visibles dans la scène` : ''}

Pour chaque scène, génère :
- "index": numéro de scène (commence à 0)
- "description_visuelle": prompt visuel en ANGLAIS pour Flux (max 120 chars). RÈGLE CRITIQUE : décris UNIQUEMENT le contenu visuel UNIQUE de cette scène — QUI est visible, QUOI se passe, OÙ. NE PAS inclure de mots de style (lighting, film grain, cinematic, etc.) — le style est appliqué automatiquement. Chaque scène doit être visuellement distincte.
- "animation_prompt": prompt de mouvement en ANGLAIS pour image-to-video (max 80 chars). Décrit le mouvement de caméra et l'action concrète.
- "texte_voix": OBLIGATOIRE — texte narré en français pendant cette scène. Jamais vide.
- "duree_estimee": durée en secondes (entier, entre 3 et 12)
${hasDialogue ? `- "speaker": NOM du personnage parlant. Optionnel pour narration, OBLIGATOIRE pour dialogues.` : ''}

RÈGLES :
1. description_visuelle : contenu visuel unique par scène (sujet + action + lieu). Pas de mots de style répétitifs. Exemples bons : "scientist examining glowing DNA strand in dark lab", "crowd celebrating in sunlit city square". Mauvais : "cinematic shot of person, dramatic lighting, film grain".
2. animation_prompt DOIT décrire un mouvement CONCRET (jamais "smooth animation" seul)
3. texte_voix est OBLIGATOIRE — distribue le script complet sur toutes les scènes sans rien omettre
${durationInstruction}
${hasDialogue ? `6. DIALOGUES : si deux personnages parlent successivement, favorise des scènes séparées pour chaque réplique (permet voix différentes)` : ''}

Style visuel de référence pour description_visuelle si besoin d'inspiration : ${styleGuide}

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

type SceneObject = { index: number; description_visuelle: string; animation_prompt: string; texte_voix: string; duree_estimee: number; speaker?: string }

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
  // Match each complete {...} object within the scenes array
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

    const { system, user } = buildStoryboardPrompts({ script, style, duration, title, description })

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = extractJson(raw)

    if (!Array.isArray(parsed.scenes)) throw new Error('Invalid storyboard: missing scenes array')

    return NextResponse.json({ scenes: parsed.scenes, total_duration: parsed.total_duration })
  } catch (err) {
    console.error('[generate-storyboard]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Storyboard generation failed', code: 'GENERATION_ERROR' },
      { status: 500 }
    )
  }
}
