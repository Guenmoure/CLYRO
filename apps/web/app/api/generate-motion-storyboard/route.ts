import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MotionScene {
  index: number
  // Voix off
  texte_voix: string
  duree_estimee: number   // secondes
  // Remotion params — ce que l'utilisateur peut éditer
  text: string            // texte principal affiché
  subtext: string         // sous-titre / description courte
  highlight: string       // mot clé à mettre en gradient (extrait de `text`)
  icon: string            // emoji représentatif
  style: 'hero' | 'feature' | 'stats' | 'outro' | 'text-focus'
  accent_color: string    // couleur d'accent hex
  stats?: Array<{ value: string; label: string }>
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un directeur artistique expert en motion design vidéo.

Ta mission : analyser un brief visuel et un script de voix off, puis générer un storyboard JSON structuré pour une vidéo animée avec Remotion.

RÈGLES STRICTES :
1. Découpe le script en 4 à 8 scènes narratives cohérentes.
2. Chaque scène correspond à une phrase ou un bloc de phrases du script.
3. texte_voix = extrait exact du script pour cette scène (max 20 mots).
4. text = titre court et impactant pour la scène (max 6 mots, peut différer de texte_voix).
5. subtext = complément visuel court (max 12 mots, optionnel mais recommandé).
6. highlight = UN seul mot de "text" qui sera mis en gradient coloré. Doit être un mot exact présent dans "text".
7. icon = un seul emoji représentatif du concept de la scène.
8. style = choix narratif :
   - "hero"       → ouverture forte, accroche principale
   - "feature"    → point clé, argument, bénéfice
   - "stats"      → données chiffrées, statistiques
   - "text-focus" → citation, concept fort, minimaliste
   - "outro"      → conclusion, appel à l'action, fermeture
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

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brief: string
      script: string
      format?: string
      duration?: string
    }

    const { brief, script } = body

    if (!brief?.trim() || !script?.trim()) {
      return NextResponse.json({ error: 'brief et script sont requis.' }, { status: 400 })
    }
    if (script.trim().length < 20) {
      return NextResponse.json({ error: 'Script trop court (min 20 caractères).' }, { status: 400 })
    }

    const userMessage = `BRIEF VISUEL :
${brief.trim()}

SCRIPT VOIX OFF :
${script.trim()}

${body.format ? `Format vidéo : ${body.format}` : ''}
${body.duration ? `Durée cible : ${body.duration}` : ''}

Génère le storyboard Remotion JSON.`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Impossible de parser le storyboard.' }, { status: 500 })
    }

    const storyboard = JSON.parse(jsonMatch[0]) as { scenes: MotionScene[] }
    return NextResponse.json({ scenes: storyboard.scenes })
  } catch (err) {
    console.error('[generate-motion-storyboard]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
