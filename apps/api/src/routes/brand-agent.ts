import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
// Audit 16/06/26 — was instantiating its own Anthropic client + using a
// stale model version. Now imports the shared singleton + MODEL constant
// from services/claude.ts.
import { anthropic, MODEL } from '../services/claude'

export const brandAgentRouter = Router()

const chatSchema = z.object({
  brand_kit_id: z.string().uuid().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000),
  })).min(1).max(30),
  context: z.object({
    name: z.string().optional(),
    industry: z.string().optional(),
    target_audience: z.string().optional(),
    values: z.string().optional(),
    existing_colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
    }).optional(),
  }).optional(),
})

/**
 * POST /api/v1/brand/agent/chat
 * Conversational brand identity builder
 */
brandAgentRouter.post('/brand/agent/chat', authMiddleware, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, messages, context } = parsed.data

  try {
    // Fetch existing kit if provided
    let existingKit: { name: string; primary_color: string; secondary_color: string | null; font_family: string | null } | null = null
    if (brand_kit_id) {
      const { data } = await supabaseAdmin
        .from('brand_kits')
        .select('name, primary_color, secondary_color, font_family')
        .eq('id', brand_kit_id)
        .eq('user_id', req.userId)
        .single()
      existingKit = data
    }

    const systemPrompt = `You are CLYRO's Brand Strategist AI — an expert in brand identity, visual design, and marketing strategy.

Your role is to help the user build or refine their brand identity through conversation.

CAPABILITIES:
1. Help define brand positioning, values, tone of voice
2. Suggest color palettes with hex codes (always provide exact hex values like #6366F1)
3. Recommend typography pairings (heading + body fonts)
4. Guide logo direction (monogram, wordmark, emblem, abstract mark)
5. Define target audience personas
6. Craft taglines and brand messaging
7. Suggest visual mood and style direction

RULES:
- Be concise and actionable — give specific recommendations, not vague advice
- When suggesting colors, always provide hex codes in a structured way
- When the user's brand identity seems clear enough, suggest they save it
- Reference their industry and audience in recommendations
- If they have an existing kit, suggest improvements based on brand best practices
- Respond in the same language the user uses

RESPONSE FORMAT:
When you have concrete brand recommendations, include a JSON block at the end:
\`\`\`brand_update
{
  "suggestions": {
    "name": "Brand Name",
    "primary_color": "#hex",
    "secondary_color": "#hex",
    "font_heading": "Font Name",
    "font_body": "Font Name",
    "tagline": "Suggested tagline",
    "tone": "playful|professional|luxurious|minimalist|bold"
  }
}
\`\`\`
Only include fields that were discussed/decided in this conversation turn.
If no concrete suggestions yet, omit the JSON block entirely.

${context ? `CURRENT BRAND CONTEXT:\n- Name: ${context.name || 'Not set'}\n- Industry: ${context.industry || 'Not specified'}\n- Target: ${context.target_audience || 'Not defined'}\n- Values: ${context.values || 'Not defined'}\n- Colors: ${context.existing_colors?.primary || 'Not set'} / ${context.existing_colors?.secondary || 'Not set'}` : ''}
${existingKit ? `\nEXISTING BRAND KIT:\n- Name: ${existingKit.name}\n- Primary: ${existingKit.primary_color}\n- Secondary: ${existingKit.secondary_color || 'None'}\n- Font: ${existingKit.font_family || 'Not set'}` : ''}`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse brand_update block if present
    let suggestions: Record<string, string> | undefined
    const jsonMatch = text.match(/```brand_update\s*\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        suggestions = parsed.suggestions
      } catch { /* ignore parse errors */ }
    }

    // Clean reply (remove the JSON block from visible text)
    const reply = text.replace(/```brand_update[\s\S]*?```/g, '').trim()

    logger.info({ userId: req.userId, brand_kit_id, msgCount: messages.length }, 'Brand agent chat')
    res.json({ reply, suggestions })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/agent/chat error')
    res.status(500).json({ error: 'Brand agent failed', code: 'GENERATION_ERROR' })
  }
})
