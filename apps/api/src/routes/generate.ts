import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { authMiddleware } from '../middleware/auth'
import { logger } from '../lib/logger'
import {
  buildStoryboardPrompts,
  buildImprovePromptContent,
  buildRegenScenePromptsContent,
  buildBrandAnalystPrompts,
  BRAND_STRATEGY_SYSTEM,
  buildBrandStrategyUserPrompt,
  buildBrandChartePrompts,
  buildBrandHybridUserPrompt,
} from '../prompts'
import { generateMotionStoryboard } from '../services/claude'
import { sendBrandKitReadyEmail } from '../services/resend'

export const generateRouter = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Brief quality gate ────────────────────────────────────────────────────────

const GENERIC_NAMES = new Set(['brand', 'marque', 'test', 'ma marque', 'mon projet', 'startup', 'entreprise', 'company', 'my brand'])

interface BriefQualityResult {
  ok: boolean
  score: number          // 0-100
  issues: string[]       // human-readable, shown in UI
  warnings: string[]
}

function validateBriefQuality(brief: {
  name?: string; secteur?: string; cible?: string; valeurs?: string[]; ambiance?: string
}): BriefQualityResult {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100

  const name    = (brief.name    ?? '').trim()
  const secteur = (brief.secteur ?? '').trim()
  const cible   = (brief.cible   ?? '').trim()
  const valeurs = (brief.valeurs ?? []).map((v) => v.trim()).filter(Boolean)

  // ── Champs obligatoires ──────────────────────────────────────────────────
  if (name.length < 2) {
    issues.push('Le nom de marque est trop court (min 2 caractères)')
    score -= 35
  } else if (GENERIC_NAMES.has(name.toLowerCase())) {
    issues.push(`"${name}" est un placeholder — utilise le vrai nom de ta marque`)
    score -= 25
  }

  if (secteur.length < 4) {
    issues.push('Le secteur d\'activité est requis (ex: "SaaS B2B", "Cosmétiques naturels")')
    score -= 30
  } else if (secteur.length < 12) {
    warnings.push('Le secteur est vague — précise-le davantage pour de meilleurs résultats')
    score -= 10
  }

  if (cible.length < 4) {
    issues.push('La cible est requise (ex: "Freelances tech 25-40 ans", "PME e-commerce")')
    score -= 30
  } else if (cible.length < 12) {
    warnings.push('La cible est vague — décris l\'audience plus précisément')
    score -= 10
  }

  if (valeurs.length === 0) {
    issues.push('Au moins 1 valeur de marque est requise')
    score -= 20
  } else if (valeurs.length < 2) {
    warnings.push('Ajoute 2-3 valeurs de marque pour des résultats plus cohérents')
    score -= 10
  }

  // ── Richesse globale du brief ──────────────────────────────────────────────
  const totalWords = [name, secteur, cible, ...valeurs].join(' ').split(/\s+/).filter(Boolean).length
  if (totalWords < 6) {
    warnings.push('Le brief est très succinct — plus de détails = meilleure identité générée')
    score -= 10
  }

  return { ok: issues.length === 0 && score >= 40, score: Math.max(0, score), issues, warnings }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, label = 'generate'): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const delay = 500 * Math.pow(2, attempt - 1) // 500ms, 1s, 2s
      logger.warn({ err, attempt, label }, `Claude call failed — retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

// ── JSON extraction helper ─────────────────────────────────────────────────────

function extractJson(raw: string): string {
  const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in Claude response')
  return match[0]
}

// ── POST /generate/storyboard ─────────────────────────────────────────────────

generateRouter.post('/generate/storyboard', authMiddleware, async (req, res) => {
  try {
    const { script, style, duration = '30s', title, description } = req.body as {
      script: string; style: string; duration?: string; title?: string; description?: string
    }

    if (!script || !style) {
      res.status(400).json({ error: 'script and style are required', code: 'VALIDATION_ERROR' })
      return
    }
    if (script.trim().length < 20) {
      res.status(400).json({ error: 'Script trop court (min 20 caractères).', code: 'VALIDATION_ERROR' })
      return
    }

    const { system, user } = buildStoryboardPrompts({ script, style, duration, title, description })

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }), 3, 'storyboard')

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(extractJson(raw)) as {
      scenes: Array<{ index: number; description_visuelle: string; animation_prompt: string; texte_voix: string; duree_estimee: number }>
      total_duration: number
    }

    if (!Array.isArray(parsed.scenes)) throw new Error('Invalid storyboard: missing scenes array')

    logger.info({ userId: req.userId, sceneCount: parsed.scenes.length, style, duration, tokens: message.usage }, 'Storyboard generated')
    res.json({ scenes: parsed.scenes, total_duration: parsed.total_duration })
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/storyboard] error')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Storyboard generation failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/motion-storyboard ─────────────────────────────────────────
// Uses the same generateMotionStoryboard() as the pipeline — single source of truth.

const SCENE_TYPE_TO_STYLE: Record<string, string> = {
  text_hero:        'hero',
  split_text_image: 'feature',
  product_showcase: 'feature',
  stats_counter:    'stats',
  cta_end:          'outro',
  image_full:       'feature',
}

const SCENE_TYPE_ICONS: Record<string, string> = {
  text_hero:        '✨',
  split_text_image: '🖼',
  product_showcase: '📦',
  stats_counter:    '📊',
  cta_end:          '🎯',
  image_full:       '🎬',
}

generateRouter.post('/generate/motion-storyboard', authMiddleware, async (req, res) => {
  try {
    const { brief, script, format, duration } = req.body as {
      brief: string; script: string; format?: string; duration?: string
    }

    const combinedBrief = [brief?.trim(), script?.trim()].filter(Boolean).join('\n\n')

    if (!combinedBrief || combinedBrief.length < 20) {
      res.status(400).json({ error: 'brief ou script requis (min 20 caractères).', code: 'VALIDATION_ERROR' })
      return
    }

    const storyboard = await generateMotionStoryboard(
      combinedBrief,
      'dynamique',
      format ?? '9:16',
      duration ?? '30s'
    )

    // Map new BrandScene format → MotionScene (UI backward compat + forward fields)
    const ACCENT_COLORS = ['#00CFFF', '#9B59FF', '#FF6B6B', '#00C896', '#FFB347', '#FF9FF3']
    const mappedScenes = storyboard.scenes.map((s, idx) => ({
      ...s,
      // Old MotionScene fields (for motion-studio.tsx SceneCard/ScenePreview)
      text:         s.display_text ?? s.texte_voix ?? '',
      subtext:      s.cta_text ?? '',
      highlight:    (s.display_text ?? '').split(' ')[0] ?? '',
      icon:         SCENE_TYPE_ICONS[s.scene_type ?? ''] ?? '▶',
      style:        SCENE_TYPE_TO_STYLE[s.scene_type ?? ''] ?? 'feature',
      accent_color: ACCENT_COLORS[idx % ACCENT_COLORS.length],
      // New fields preserved
      display_text:     s.display_text,
      scene_type:       s.scene_type,
      animation_type:   s.animation_type,
      needs_background: s.needs_background,
      cta_text:         s.cta_text,
    }))

    logger.info({ userId: req.userId, sceneCount: mappedScenes.length }, 'Motion storyboard generated (unified schema)')
    res.json({ scenes: mappedScenes })
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/motion-storyboard] error')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur serveur', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/improve-prompt ────────────────────────────────────────────

generateRouter.post('/generate/improve-prompt', authMiddleware, async (req, res) => {
  try {
    const { prompt, imageUrl, style, feedback } = req.body as {
      prompt: string; imageUrl?: string; style: string; feedback?: string
    }

    if (!prompt || !style) {
      res.status(400).json({ error: 'prompt and style are required', code: 'VALIDATION_ERROR' })
      return
    }

    type ContentBlock = { type: 'image'; source: { type: 'url'; url: string } } | { type: 'text'; text: string }
    const content: ContentBlock[] = []
    if (imageUrl) content.push({ type: 'image', source: { type: 'url', url: imageUrl } })
    content.push({ type: 'text', text: buildImprovePromptContent({ prompt, style, feedback, hasImage: !!imageUrl }) })

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    }), 3, 'improve-prompt')

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const data = JSON.parse(extractJson(raw)) as { improvedPrompt: string; explanation: string; keyChanges: string[] }

    if (!data.improvedPrompt) {
      res.status(500).json({ error: 'Failed to generate improved prompt', code: 'GENERATION_ERROR' })
      return
    }

    res.json(data)
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/improve-prompt] error')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Prompt improvement failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/regen-scene-prompts ───────────────────────────────────────

generateRouter.post('/generate/regen-scene-prompts', authMiddleware, async (req, res) => {
  try {
    const { scriptText, style } = req.body as { scriptText: string; style: string }

    if (!scriptText || !style) {
      res.status(400).json({ error: 'scriptText and style are required', code: 'VALIDATION_ERROR' })
      return
    }

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: 'You are a video production expert. Return only valid JSON, no markdown.',
      messages: [{ role: 'user', content: buildRegenScenePromptsContent(scriptText, style) }],
    }), 3, 'regen-scene-prompts')

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const data = JSON.parse(extractJson(raw)) as { imagePrompt: string; animationPrompt: string }

    if (!data.imagePrompt || !data.animationPrompt) {
      res.status(500).json({ error: 'Failed to parse prompts from AI response', code: 'GENERATION_ERROR' })
      return
    }

    res.json(data)
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/regen-scene-prompts] error')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Prompt regeneration failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/brand-analyst ─────────────────────────────────────────────

generateRouter.post('/generate/brand-analyst', authMiddleware, async (req, res) => {
  try {
    const brief = req.body
    const { system, user } = buildBrandAnalystPrompts(brief)

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }), 3, 'brand-analyst')

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(extractJson(raw))

    // Check if contradictions were detected requiring path selection
    if (result.has_contradiction && result.contradiction_paths && result.contradiction_paths.length === 2) {
      logger.info(
        { userId: req.userId, contradictions: result.contradictions, pathCount: result.contradiction_paths.length },
        'Brand analyst detected contradictions requiring path selection'
      )
      res.status(409).json({
        error: 'Le brief contient des contradictions — sélectionne un chemin créatif.',
        code: 'BRIEF_CONTRADICTION_DETECTED',
        has_contradiction: true,
        contradiction_paths: result.contradiction_paths,
        contradictions: result.contradictions,
        brief_score: result.brief_score,
        ...result, // Include all other analyst fields
      })
      return
    }

    // Check if brief quality is insufficient
    if (result.brief_quality === 'insufficient') {
      logger.info(
        { userId: req.userId, briefQuality: result.brief_quality, questions: result.clarification_questions },
        'Brand analyst detected insufficient brief quality'
      )
      res.status(422).json({
        error: 'Le brief est insuffisant pour générer une identité de qualité.',
        code: 'BRIEF_QUALITY_INSUFFICIENT',
        brief_quality: 'insufficient',
        clarification_questions: result.clarification_questions ?? [],
        ...result, // Include all other analyst fields
      })
      return
    }

    res.json(result)
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/brand-analyst] error')
    // Graceful fallback — don't block the user
    res.json({ is_ready: true, brief_score: 70, contradictions: [], questions: [], suggestions: [], brief_quality: 'sufficient' })
  }
})

// ── POST /generate/brand-strategy (SSE streaming) ────────────────────────────

generateRouter.post('/generate/brand-strategy', authMiddleware, async (req, res) => {
  const brief = req.body

  if (!brief.name || !brief.secteur || !brief.cible || !brief.ambiance) {
    res.status(400).json({ error: 'Champs requis manquants (name, secteur, cible, ambiance)', code: 'VALIDATION_ERROR' })
    return
  }

  // ── Quality gate — bloque les briefs trop pauvres avant d'appeler Claude ──
  const quality = validateBriefQuality(brief)
  if (!quality.ok) {
    logger.info({ userId: req.userId, score: quality.score, issues: quality.issues }, 'Brief quality gate rejected')
    res.status(422).json({
      error: 'Le brief est insuffisant pour générer une identité de qualité.',
      code: 'BRIEF_QUALITY_GATE',
      score: quality.score,
      issues: quality.issues,
      warnings: quality.warnings,
    })
    return
  }
  if (quality.warnings.length > 0) {
    logger.info({ userId: req.userId, score: quality.score, warnings: quality.warnings }, 'Brief quality warnings (non-blocking)')
  }

  const wantsStream = req.headers.accept?.includes('text/event-stream')

  if (wantsStream) {
    // SSE streaming — client gets chunks as Claude generates
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      let fullText = ''
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: BRAND_STRATEGY_SYSTEM,
        messages: [{ role: 'user', content: buildBrandStrategyUserPrompt(brief) }],
      })

      stream.on('text', (chunk) => {
        fullText += chunk
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })

      await stream.finalMessage()
      const strategy = JSON.parse(extractJson(fullText))
      res.write(`data: ${JSON.stringify({ done: true, strategy })}\n\n`)
      res.end()
      logger.info({ userId: req.userId }, 'Brand strategy streamed')
    } catch (err) {
      logger.error({ err, userId: req.userId }, '[generate/brand-strategy SSE] error')
      res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' })}\n\n`)
      res.end()
    }
  } else {
    // Regular JSON response with retry
    try {
      const message = await withRetry(() => anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: BRAND_STRATEGY_SYSTEM,
        messages: [{ role: 'user', content: buildBrandStrategyUserPrompt(brief) }],
      }), 3, 'brand-strategy')

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      const strategy = JSON.parse(extractJson(raw))

      if (!strategy.directions || strategy.directions.length !== 3) {
        res.status(500).json({ error: 'Réponse invalide — directions manquantes', code: 'GENERATION_ERROR' })
        return
      }

      logger.info({ userId: req.userId, tokens: message.usage }, 'Brand strategy generated')
      res.json(strategy)
    } catch (err) {
      logger.error({ err, userId: req.userId }, '[generate/brand-strategy] error')
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur serveur', code: 'GENERATION_ERROR' })
    }
  }
})

// ── POST /generate/brand-charte (SSE streaming) ───────────────────────────────

generateRouter.post('/generate/brand-charte', authMiddleware, async (req, res) => {
  const { brief, direction } = req.body as { brief: unknown; direction: unknown }

  if (!brief || !direction) {
    res.status(400).json({ error: 'brief and direction are required', code: 'VALIDATION_ERROR' })
    return
  }

  const wantsStream = req.headers.accept?.includes('text/event-stream')
  const { system, user } = buildBrandChartePrompts(brief as Parameters<typeof buildBrandChartePrompts>[0], direction as Parameters<typeof buildBrandChartePrompts>[1])

  function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgb(${r}, ${g}, ${b})`
  }

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      let fullText = ''
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: user }],
      })

      stream.on('text', (chunk) => {
        fullText += chunk
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })

      await stream.finalMessage()
      const charte = JSON.parse(extractJson(fullText))
      if (charte.colors) charte.colors = charte.colors.map((c: { hex: string; rgb?: string }) => ({ ...c, rgb: c.rgb || hexToRgb(c.hex) }))
      res.write(`data: ${JSON.stringify({ done: true, charte })}\n\n`)
      res.end()
    } catch (err) {
      logger.error({ err, userId: req.userId }, '[generate/brand-charte SSE] error')
      res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' })}\n\n`)
      res.end()
    }
  } else {
    try {
      const message = await withRetry(() => anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: user }],
      }), 3, 'brand-charte')

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      const charte = JSON.parse(extractJson(raw))
      if (charte.colors) charte.colors = charte.colors.map((c: { hex: string; rgb?: string }) => ({ ...c, rgb: c.rgb || hexToRgb(c.hex) }))

      logger.info({ userId: req.userId, tokens: message.usage }, 'Brand charte generated')
      res.json(charte)
    } catch (err) {
      logger.error({ err, userId: req.userId }, '[generate/brand-charte] error')
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur serveur', code: 'GENERATION_ERROR' })
    }
  }
})

// ── POST /generate/brand-hybrid ───────────────────────────────────────────────

generateRouter.post('/generate/brand-hybrid', authMiddleware, async (req, res) => {
  try {
    const { brief, strategy, directions, palette_from, typography_from, logo_from } = req.body as {
      brief?: { name: string; secteur: string }
      strategy?: { directions: Array<{ name: string; palette: object; typography: { heading: string; body: string }; keywords?: string[]; mood?: string }> }
      directions?: Array<{ name: string; palette: object; typography: { heading: string; body: string }; keywords?: string[]; mood?: string }>
      palette_from: number
      typography_from: number
      logo_from?: number
    }

    // Accept both { strategy: { directions } } and { directions } formats
    const dirs = strategy?.directions ?? directions
    if (!dirs) {
      res.status(400).json({ error: 'directions or strategy.directions required', code: 'VALIDATION_ERROR' })
      return
    }

    const palDir = dirs[palette_from]
    const typDir = dirs[typography_from]
    const logoDir = typeof logo_from === 'number' ? dirs[logo_from] : undefined

    if (!palDir || !typDir) {
      res.status(400).json({ error: 'Invalid direction indices', code: 'VALIDATION_ERROR' })
      return
    }

    const userPrompt = buildBrandHybridUserPrompt({
      brandName: brief?.name ?? 'Brand',
      secteur: brief?.secteur ?? '',
      paletteDirName: palDir.name,
      palette: palDir.palette,
      typHeading: typDir.typography.heading,
      typBody: typDir.typography.body,
      logoKeywords: logoDir?.keywords,
      logoMood: logoDir?.mood,
    })

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'Tu es un directeur artistique expert. Tu réponds UNIQUEMENT en JSON valide.',
      messages: [{ role: 'user', content: userPrompt }],
    }), 3, 'brand-hybrid')

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const hybridDirection = JSON.parse(extractJson(raw))

    logger.info({ userId: req.userId, tokens: message.usage }, 'Brand hybrid direction generated')
    res.json(hybridDirection)
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/brand-hybrid] error')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Hybrid generation failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /notify/brand-kit-ready ──────────────────────────────────────────────

generateRouter.post('/notify/brand-kit-ready', async (req, res) => {
  try {
    const { email, brandName, downloadUrl } = req.body as {
      email: string
      brandName: string
      downloadUrl: string
    }

    if (!email || !brandName || !downloadUrl) {
      res.status(400).json({ error: 'email, brandName, and downloadUrl required' })
      return
    }

    await sendBrandKitReadyEmail(email, brandName, downloadUrl)
    logger.info({ email, brandName }, 'Brand kit ready email sent')
    res.json({ ok: true })
  } catch (err) {
    logger.error({ err }, '[notify/brand-kit-ready] error')
    res.status(500).json({ error: 'Failed to send email' })
  }
})

// ── POST /generate/extract-style-tokens ───────────────────────────────────────
// Analyzes scene 0 image via Claude Vision and extracts reusable style tokens
// for visual consistency across scenes 1..N

generateRouter.post('/generate/extract-style-tokens', authMiddleware, async (req, res) => {
  try {
    const { image_url, style } = req.body as { image_url: string; style?: string }

    if (!image_url) {
      res.status(400).json({ error: 'image_url required', code: 'VALIDATION_ERROR' })
      return
    }

    // Fetch image and convert to base64 (Anthropic only supports base64, not URL)
    const imgRes = await fetch(image_url)
    if (!imgRes.ok) {
      res.status(400).json({ error: 'Could not fetch image_url', code: 'VALIDATION_ERROR' })
      return
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer())
    const imgB64 = imgBuf.toString('base64')
    const contentType = (imgRes.headers.get('content-type') ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: contentType, data: imgB64 },
          },
          {
            type: 'text',
            text: `Analyse cette image et extrais les tokens visuels réutilisables pour maintenir la cohérence dans les scènes suivantes d'une vidéo ${style ?? ''}.

Réponds UNIQUEMENT avec ce JSON :
{
  "dominant_colors": ["#HEX1", "#HEX2", "#HEX3"],
  "lighting": "description courte (ex: 'warm golden hour', 'cold blue studio')",
  "texture": "description courte (ex: 'grain film', 'clean digital', 'watercolor')",
  "composition_style": "description courte (ex: 'centered symmetrical', 'rule of thirds')",
  "mood": "description courte (ex: 'energetic', 'calme luxe')",
  "style_prompt_suffix": "phrase en anglais à ajouter à chaque prompt pour garder la cohérence visuelle (max 30 mots)"
}`,
          },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const tokens = JSON.parse(extractJson(raw))

    logger.info({ userId: req.userId, inputTokens: message.usage.input_tokens }, 'Style tokens extracted from scene 0')
    res.json(tokens)
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[generate/extract-style-tokens] error')
    res.status(500).json({ error: 'Failed to extract style tokens', code: 'SERVICE_ERROR' })
  }
})
