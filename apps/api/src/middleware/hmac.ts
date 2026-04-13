import { createHmac, timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

const REPLAY_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Middleware HMAC-SHA256 pour les routes internes inter-services.
 *
 * Protocole attendu par l'appelant :
 *   1. Prendre le timestamp UNIX en ms : ts = Date.now()
 *   2. Calculer la signature : HMAC-SHA256(secret, `${ts}.${rawBody}`)
 *   3. Envoyer les headers :
 *        x-clyro-timestamp: <ts>
 *        x-clyro-signature: <hex_signature>
 *
 * Protections :
 *   - Replay : rejette si |now - ts| > 5 min
 *   - Timing : comparaison en temps constant (timingSafeEqual)
 *   - Secret absent → 500 (erreur de config, pas 401)
 *
 * Usage :
 *   app.use('/api/internal', hmacMiddleware, internalRouter)
 */
export async function hmacMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = process.env.INTERNAL_HMAC_SECRET
  if (!secret) {
    logger.error('INTERNAL_HMAC_SECRET is not set — internal routes are disabled')
    res.status(500).json({ error: 'Server configuration error', code: 'CONFIG_ERROR' })
    return
  }

  const tsHeader  = req.headers['x-clyro-timestamp']
  const sigHeader = req.headers['x-clyro-signature']

  if (!tsHeader || !sigHeader || typeof tsHeader !== 'string' || typeof sigHeader !== 'string') {
    res.status(401).json({ error: 'Missing HMAC headers', code: 'UNAUTHORIZED' })
    return
  }

  const ts = Number(tsHeader)
  if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    logger.warn({ ts, now: Date.now(), path: req.path }, 'HMAC replay/clock-skew rejected')
    res.status(401).json({ error: 'Request expired or clock skew too large', code: 'REPLAY_DETECTED' })
    return
  }

  // Raw body must be a Buffer (mount internal routes with express.raw() or read req.body as-is)
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? '')

  const expected = createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expected)
  const actualBuf   = Buffer.from(sigHeader)

  const valid =
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf)

  if (!valid) {
    logger.warn({ path: req.path }, 'HMAC signature mismatch — internal request rejected')
    res.status(401).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' })
    return
  }

  next()
}

/**
 * Génère les headers HMAC pour un appel interne vers l'API.
 * À utiliser côté appelant (worker, cron, script de migration).
 *
 * @example
 * const headers = signInternalRequest(body)
 * await fetch(`${API_URL}/api/internal/some-route`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', ...headers },
 *   body,
 * })
 */
export function signInternalRequest(body: string | object): Record<string, string> {
  const secret = process.env.INTERNAL_HMAC_SECRET
  if (!secret) throw new Error('INTERNAL_HMAC_SECRET is not set')

  const ts      = Date.now().toString()
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  const sig     = createHmac('sha256', secret)
    .update(`${ts}.${payload}`)
    .digest('hex')

  return {
    'x-clyro-timestamp': ts,
    'x-clyro-signature': sig,
  }
}
