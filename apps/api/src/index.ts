import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { logger } from './lib/logger'
import { healthRouter } from './routes/health'
import { pipelineFacelessRouter } from './routes/pipeline/faceless'
import { pipelineMotionRouter } from './routes/pipeline/motion'
import { videosRouter } from './routes/videos'
import { voicesRouter } from './routes/voices'
import { checkoutRouter } from './routes/checkout'
import { stripeWebhookRouter } from './routes/webhooks/stripe'
import { monerooWebhookRouter } from './routes/webhooks/moneroo'

const app = express()
const PORT = process.env.PORT ?? 4000

// ── Minimal health check (avant tout middleware) ───────────────────────────
// Render (et autres proxies) ne envoient pas de header Origin → CORS bloquerait
// Ce endpoint répond immédiatement sans passer par CORS/auth/rate-limit
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'clyro-api' })
})

// ── Security headers (Helmet) ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  })
)

// ── CORS — autoriser uniquement les origines CLYRO ────────────────────────
// FRONTEND_URLS accepte une liste séparée par des virgules pour les déploiements multi-env
const ALLOWED_ORIGINS = [
  ...(process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
  'https://app.clyro.app',
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (Postman, curl, iframes about:blank)
      // Les endpoints nécessitent tous un JWT valide → pas de risque CSRF
      if (!origin) {
        callback(null, true)
      } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS policy: origin ${origin ?? 'null'} not allowed`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ── Rate Limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
})

const pipelineLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // max 20 générations par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Pipeline rate limit exceeded', code: 'PIPELINE_RATE_LIMIT' },
})

const voiceCloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // max 5 clonages par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Voice clone rate limit exceeded', code: 'VOICE_CLONE_RATE_LIMIT' },
})

// ── Body parsers ───────────────────────────────────────────────────────────
// IMPORTANT : les webhooks Stripe/Moneroo nécessitent le raw body
// → monter AVANT express.json()
app.use('/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Request logging ────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path, ip: req.ip }, 'Incoming request')
  next()
})

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check (pas de rate limit, pas d'auth)
app.use('/api/v1', healthRouter)

// Webhooks (pas d'authMiddleware, signature vérification dans les routes)
app.use('/webhook', stripeWebhookRouter)
app.use('/webhook', monerooWebhookRouter)

// Routes API protégées
app.use('/api/v1', apiLimiter)
app.use('/api/v1/pipeline', pipelineLimiter, pipelineFacelessRouter)
app.use('/api/v1/pipeline', pipelineLimiter, pipelineMotionRouter)
app.use('/api/v1', videosRouter)
app.use('/api/v1/voices/clone', voiceCloneLimiter)
app.use('/api/v1', voicesRouter)
app.use('/api/v1', checkoutRouter)

// ── Global error handler ───────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error({ err }, 'Unhandled error')
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
)

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' })
})

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'CLYRO API server started')
})

export default app
