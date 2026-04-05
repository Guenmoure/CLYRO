import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── Prompts par niche ──────────────────────────────────────────────────────────

const NICHE_CONTEXT: Record<string, { tone: string; visual_guidance: string }> = {
  finance: {
    tone: 'pédagogique, rassurant, accessible — vulgarise les concepts financiers avec des métaphores simples',
    visual_guidance:
      'graphiques animés, piles de pièces, pourcentages, tableaux de budget, flèches de croissance, euro/dollar symbols',
  },
  neurosciences: {
    tone: 'scientifique mais vulgarisé, fascinant — rend les concepts du cerveau captivants pour le grand public',
    visual_guidance:
      'neurones lumineux, cerveau stylisé 3D, synapses qui s\'activent, circuits électriques, ondes cérébrales, zones du cerveau en couleur',
  },
  psychologie: {
    tone: 'empathique, introspectif, doux — crée un espace de réflexion et de compréhension de soi',
    visual_guidance:
      'personnages symboliques aux émotions visibles, métaphores visuelles (nuages, miroirs, ponts), formes abstraites représentant des états intérieurs',
  },
  developpement_personnel: {
    tone: 'motivant, énergique, inspirant — donne envie d\'agir immédiatement',
    visual_guidance:
      'personnes qui surmontent des obstacles, progressions visuelles (graphe montant), transformations (chenille → papillon), symboles de réussite et de croissance',
  },
}

// ── Prompts par style visuel ───────────────────────────────────────────────────

const STYLE_VISUAL_PREFIX: Record<string, string> = {
  'animation-2d':
    'Cartoon 2D flat illustration, vibrant colors, character with expressive face, smooth animation',
  'stock-vo':
    'Realistic cinematic shot, high quality photograph or video frame, professional lighting',
  minimaliste:
    'Minimalist design, clean white or dark background, bold typography, geometric shapes, no clutter',
  infographie:
    'Animated infographic, data visualization, icons, charts, flat design, bold colors, information hierarchy',
  whiteboard:
    'Whiteboard animation, hand-drawn black ink on white background, sketch style, progressive reveal',
  cinematique:
    'Cinematic shot, dramatic lighting, high contrast, film grain, wide-angle or close-up, emotional depth',
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(niche: string, style: string): string {
  const nicheCtx = NICHE_CONTEXT[niche] ?? NICHE_CONTEXT['developpement_personnel']
  const stylePrefix = STYLE_VISUAL_PREFIX[style] ?? STYLE_VISUAL_PREFIX['minimaliste']

  return `Tu es un expert en production de contenu vidéo éducatif et viral pour les réseaux sociaux.

NICHE : ${niche.replace(/_/g, ' ')}
TON : ${nicheCtx.tone}
STYLE VISUEL : ${style}

Ta tâche : transformer un script en un storyboard JSON structuré de 4 à 8 scènes courtes.

RÈGLES STRICTES :
1. Chaque scène fait 4 à 8 secondes (duree_estimee en secondes, entier).
2. texte_voix : phrase courte, percutante (max 25 mots). Doit ACCROCHER, PAS d'informations parasites.
3. description_visuelle : commence TOUJOURS par "${stylePrefix}," puis décris la scène précisément en anglais (pour l'IA de génération d'image). Max 80 mots.
4. Assure la progression narrative : Accroche → Développement → Conclusion / CTA.
5. Varie les angles de caméra et les éléments visuels. Évite la répétition.
6. Guidance visuelle pour cette niche : ${nicheCtx.visual_guidance}

RÉPONDS UNIQUEMENT avec du JSON valide, rien d'autre. Format :
{
  "scenes": [
    {
      "index": 1,
      "texte_voix": "...",
      "description_visuelle": "...",
      "duree_estimee": 6
    }
  ]
}`
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      niche: string
      style: string
      title: string
      script: string
    }

    const { niche, style, title, script } = body

    if (!niche || !style || !title || !script) {
      return NextResponse.json({ error: 'Champs manquants : niche, style, title, script requis.' }, { status: 400 })
    }

    if (script.length < 30) {
      return NextResponse.json({ error: 'Script trop court (min 30 caractères).' }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(niche, style)

    const userMessage = `Titre de la vidéo : "${title}"

Script à découper en scènes :
${script}

Génère le storyboard JSON.`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response (handle potential markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Impossible de parser le storyboard généré.' }, { status: 500 })
    }

    const storyboard = JSON.parse(jsonMatch[0]) as { scenes: unknown[] }

    return NextResponse.json({ scenes: storyboard.scenes })
  } catch (err) {
    console.error('[generate-storyboard]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
