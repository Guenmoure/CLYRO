import { Router } from 'express'
import { z } from 'zod'
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
  buildUrlToScriptPrompts,
  type UrlToScriptLength,
} from '../prompts'
import { generateMotionStoryboard } from '../services/claude'
import { detectLanguage } from '../lib/detect-language'
import { sendBrandKitReadyEmail } from '../services/resend'
import { extractArticleFromUrl, validatePublicUrl, UrlExtractError } from '../services/urlExtract'

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
  usp?: string; concurrents?: string; references?: string
}): BriefQualityResult {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100

  const name        = (brief.name        ?? '').trim()
  const secteur     = (brief.secteur     ?? '').trim()
  const cible       = (brief.cible       ?? '').trim()
  const valeurs     = (brief.valeurs     ?? []).map((v) => v.trim()).filter(Boolean)
  const usp         = (brief.usp         ?? '').trim()
  const concurrents = (brief.concurrents ?? '').trim()
  const references  = (brief.references  ?? '').trim()

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

  // ── Champs optionnels MAIS qui boostent fortement la qualité ─────────────
  // USP est le plus gros levier qualité : sans elle, Claude tombe sur du
  // "moyen-pour-le-secteur". On chasse les utilisateurs vers ce champ via
  // un warning bien visible quand il manque, mais SANS bloquer.
  if (usp.length === 0) {
    warnings.push("Ajoute une USP claire (qu'est-ce qui rend la marque différente ?) — c'est le levier qualité #1")
    score -= 8
  } else if (usp.length < 20) {
    warnings.push("Décris la USP plus précisément (≥20 caractères, idéalement 1 phrase")
    score -= 4
  }

  if (concurrents.length === 0) {
    // Pas un warning — juste -3 pts. La majorité des briefs n'auront pas
    // de concurrents en tête.
    score -= 3
  }
  if (references.length === 0) {
    score -= 3
  }

  // ── Richesse globale du brief ──────────────────────────────────────────────
  const totalWords = [name, secteur, cible, usp, ...valeurs].join(' ').split(/\s+/).filter(Boolean).length
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

const storyboardSchema = z.object({
  script:      z.string().min(1),
  style:       z.string().min(1),
  duration:    z.string().optional().default('auto'),
  title:       z.string().optional(),
  description: z.string().optional(),
})

generateRouter.post('/generate/storyboard', authMiddleware, async (req, res) => {
  try {
    const parsedBody = storyboardSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'script and style are required', code: 'VALIDATION_ERROR' })
      return
    }
    const { script, style, duration, title, description } = parsedBody.data

    if (script.trim().length < 20) {
      res.status(400).json({ error: 'Script trop court (min 20 caractères).', code: 'VALIDATION_ERROR' })
      return
    }

    const { system, user } = buildStoryboardPrompts({ script, style, duration, title, description })

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
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
    res.status(500).json({ error: 'Storyboard generation failed', code: 'GENERATION_ERROR' })
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

const motionStoryboardSchema = z.object({
  brief:    z.string().optional(),
  script:   z.string().optional(),
  format:   z.string().optional(),
  duration: z.string().optional(),
})

generateRouter.post('/generate/motion-storyboard', authMiddleware, async (req, res) => {
  try {
    const parsedBody = motionStoryboardSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' })
      return
    }
    const { brief, script, format, duration } = parsedBody.data

    const combinedBrief = [brief?.trim(), script?.trim()].filter(Boolean).join('\n\n')

    if (!combinedBrief || combinedBrief.length < 20) {
      res.status(400).json({ error: 'brief ou script requis (min 20 caractères).', code: 'VALIDATION_ERROR' })
      return
    }

    // Detect language from the user's actual content (script if provided,
    // otherwise the combined brief) so Claude doesn't translate to French.
    const language = detectLanguage(script?.trim() || combinedBrief)
    const storyboard = await generateMotionStoryboard(
      combinedBrief,
      'dynamique',
      format ?? '9:16',
      duration ?? 'auto',
      script,
      language,
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
    res.status(500).json({ error: 'Erreur serveur', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/improve-prompt ────────────────────────────────────────────

const improvePromptSchema = z.object({
  prompt:   z.string().min(1),
  imageUrl: z.string().url().optional(),
  style:    z.string().min(1),
  feedback: z.string().optional(),
})

generateRouter.post('/generate/improve-prompt', authMiddleware, async (req, res) => {
  try {
    const parsedBody = improvePromptSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'prompt and style are required', code: 'VALIDATION_ERROR' })
      return
    }
    const { prompt, imageUrl, style, feedback } = parsedBody.data

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
    res.status(500).json({ error: 'Prompt improvement failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/regen-scene-prompts ───────────────────────────────────────

const regenScenePromptsSchema = z.object({
  scriptText: z.string().min(1),
  style:      z.string().min(1),
})

generateRouter.post('/generate/regen-scene-prompts', authMiddleware, async (req, res) => {
  try {
    const parsedBody = regenScenePromptsSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'scriptText and style are required', code: 'VALIDATION_ERROR' })
      return
    }
    const { scriptText, style } = parsedBody.data

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
    res.status(500).json({ error: 'Prompt regeneration failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /generate/brand-analyst ─────────────────────────────────────────────

// Lenient brief schema shared by the brand routes — the analyst is designed
// to "never block the user", so missing fields default to empty values and
// only structurally invalid bodies get a 400.
const brandBriefSchema = z.object({
  name:              z.string().default(''),
  secteur:           z.string().default(''),
  cible:             z.string().default(''),
  valeurs:           z.array(z.string()).default([]),
  ambiance:          z.string().default(''),
  usp:               z.string().optional(),
  couleurs_imposees: z.string().optional(),
  concurrents:       z.string().optional(),
  references:        z.string().optional(),
}).passthrough()

generateRouter.post('/generate/brand-analyst', authMiddleware, async (req, res) => {
  try {
    const parsedBody = brandBriefSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid brief body', code: 'VALIDATION_ERROR' })
      return
    }
    const brief = parsedBody.data
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

const brandStrategySchema = z.object({
  name:              z.string().min(1),
  secteur:           z.string().min(1),
  cible:             z.string().min(1),
  ambiance:          z.string().min(1),
  valeurs:           z.array(z.string()).default([]),
  usp:               z.string().optional(),
  couleurs_imposees: z.string().optional(),
  concurrents:       z.string().optional(),
  references:        z.string().optional(),
}).passthrough()

generateRouter.post('/generate/brand-strategy', authMiddleware, async (req, res) => {
  const parsedBody = brandStrategySchema.safeParse(req.body)
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Champs requis manquants (name, secteur, cible, ambiance)', code: 'VALIDATION_ERROR' })
    return
  }
  const brief = parsedBody.data

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
      res.write(`data: ${JSON.stringify({ error: 'Erreur serveur', code: 'GENERATION_ERROR' })}\n\n`)
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
      res.status(500).json({ error: 'Erreur serveur', code: 'GENERATION_ERROR' })
    }
  }
})

// ── POST /generate/brand-charte (SSE streaming) ───────────────────────────────

const brandCharteSchema = z.object({
  brief:     z.record(z.unknown()),
  direction: z.record(z.unknown()),
})

generateRouter.post('/generate/brand-charte', authMiddleware, async (req, res) => {
  const parsedBody = brandCharteSchema.safeParse(req.body)
  if (!parsedBody.success) {
    res.status(400).json({ error: 'brief and direction are required', code: 'VALIDATION_ERROR' })
    return
  }
  const { brief, direction } = parsedBody.data

  const wantsStream = req.headers.accept?.includes('text/event-stream')
  const { system, user } = buildBrandChartePrompts(
    brief as unknown as Parameters<typeof buildBrandChartePrompts>[0],
    direction as unknown as Parameters<typeof buildBrandChartePrompts>[1],
  )

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
      res.write(`data: ${JSON.stringify({ error: 'Erreur serveur', code: 'GENERATION_ERROR' })}\n\n`)
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
      res.status(500).json({ error: 'Erreur serveur', code: 'GENERATION_ERROR' })
    }
  }
})

// ── POST /generate/brand-hybrid ───────────────────────────────────────────────

const hybridDirectionSchema = z.object({
  name:       z.string(),
  palette:    z.record(z.unknown()),
  typography: z.object({ heading: z.string(), body: z.string() }).passthrough(),
  keywords:   z.array(z.string()).optional(),
  mood:       z.string().optional(),
}).passthrough()

const brandHybridSchema = z.object({
  brief:           z.object({ name: z.string(), secteur: z.string() }).passthrough().optional(),
  strategy:        z.object({ directions: z.array(hybridDirectionSchema) }).passthrough().optional(),
  directions:      z.array(hybridDirectionSchema).optional(),
  palette_from:    z.number().int(),
  typography_from: z.number().int(),
  logo_from:       z.number().int().optional(),
})

generateRouter.post('/generate/brand-hybrid', authMiddleware, async (req, res) => {
  try {
    const parsedBody = brandHybridSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid request body', code: 'VALIDATION_ERROR' })
      return
    }
    const { brief, strategy, directions, palette_from, typography_from, logo_from } = parsedBody.data

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
    res.status(500).json({ error: 'Hybrid generation failed', code: 'GENERATION_ERROR' })
  }
})

// ── POST /notify/brand-kit-ready ──────────────────────────────────────────────

const brandKitReadySchema = z.object({
  email:       z.string().email(),
  brandName:   z.string().min(1),
  downloadUrl: z.string().url(),
})

generateRouter.post('/notify/brand-kit-ready', authMiddleware, async (req, res) => {
  try {
    const parsedBody = brandKitReadySchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'email, brandName, and downloadUrl required', code: 'VALIDATION_ERROR' })
      return
    }
    const { email, brandName, downloadUrl } = parsedBody.data

    await sendBrandKitReadyEmail(email, brandName, downloadUrl)
    logger.info({ email, brandName }, 'Brand kit ready email sent')
    res.json({ ok: true })
  } catch (err) {
    logger.error({ err }, '[notify/brand-kit-ready] error')
    res.status(500).json({ error: 'Failed to send email', code: 'SERVICE_ERROR' })
  }
})

// ── POST /generate/extract-style-tokens ───────────────────────────────────────
// Analyzes scene 0 image via Claude Vision and extracts reusable style tokens
// for visual consistency across scenes 1..N

const extractStyleTokensSchema = z.object({
  image_url: z.string().url(),
  style:     z.string().optional(),
})

generateRouter.post('/generate/extract-style-tokens', authMiddleware, async (req, res) => {
  try {
    const parsedBody = extractStyleTokensSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'image_url required', code: 'VALIDATION_ERROR' })
      return
    }
    const { image_url, style } = parsedBody.data

    // Anti-SSRF — this URL is fetched server-side; block private IPs,
    // cloud metadata hosts, and non-http(s) schemes.
    try {
      validatePublicUrl(image_url)
    } catch {
      res.status(400).json({ error: 'Invalid URL', code: 'INVALID_URL' })
      return
    }

    // Fetch image and convert to base64 (Anthropic only supports base64, not URL)
    const imgRes = await fetch(image_url, { signal: AbortSignal.timeout(15_000) })
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

// ── POST /generate/script-from-url ────────────────────────────────────────────
// Audit P2: Pictory-style blog-to-video. Scrapes a public URL, extracts the main
// article text, and asks Claude to rewrite it as a spoken voice-over script
// compatible with the faceless pipeline. Response is ready to be POSTed to
// /generate/storyboard or passed to /pipeline/faceless.

const VALID_URL_LENGTHS = new Set<UrlToScriptLength>(['short', 'medium', 'long'])

const scriptFromUrlSchema = z.object({
  url:      z.string().min(1),
  length:   z.string().optional().default('medium'),
  language: z.enum(['fr', 'en']).optional(),
})

generateRouter.post('/generate/script-from-url', authMiddleware, async (req, res) => {
  try {
    const parsedBody = scriptFromUrlSchema.safeParse(req.body)
    if (!parsedBody.success) {
      res.status(400).json({ error: 'url requis.', code: 'VALIDATION_ERROR' })
      return
    }
    const { url, length, language } = parsedBody.data
    const safeLength: UrlToScriptLength = VALID_URL_LENGTHS.has(length as UrlToScriptLength)
      ? (length as UrlToScriptLength)
      : 'medium'

    const article = await extractArticleFromUrl(url)

    // Auto-detect language when not forced
    const detectedLang: 'fr' | 'en' = language ?? (article.language === 'en' ? 'en' : 'fr')

    const { system, user } = buildUrlToScriptPrompts({
      sourceUrl: article.finalUrl,
      title: article.title,
      description: article.description,
      content: article.content,
      length: safeLength,
      targetLanguage: detectedLang,
    })

    const message = await withRetry(
      () => anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      2,
      'url-to-script',
    )

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(extractJson(raw)) as {
      title: string
      script: string
      hook: string
      cta: string
      estimatedSeconds: number
      wordCount: number
      attribution: string
    }

    if (!parsed.script || typeof parsed.script !== 'string' || parsed.script.trim().length < 30) {
      throw new Error('Script généré invalide.')
    }

    logger.info(
      {
        userId: req.userId,
        sourceUrl: article.finalUrl,
        sourceWords: article.wordCount,
        length: safeLength,
        scriptWords: parsed.wordCount,
        tokens: message.usage,
      },
      'URL-to-script generated',
    )

    res.json({
      source: {
        url: article.url,
        finalUrl: article.finalUrl,
        title: article.title,
        description: article.description,
        wordCount: article.wordCount,
        language: article.language ?? detectedLang,
      },
      ...parsed,
    })
  } catch (err) {
    if (err instanceof UrlExtractError) {
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }
    logger.error({ err, userId: req.userId }, '[generate/script-from-url] error')
    res.status(500).json({
      error: 'URL-to-script generation failed',
      code: 'GENERATION_ERROR',
    })
  }
})
