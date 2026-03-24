import pino from 'pino'

/**
 * Logger structuré pino
 * - Dev : pretty print lisible
 * - Prod : JSON structuré pour les log aggregators
 *
 * RÈGLE : ne JAMAIS logger les secrets, tokens, ou données personnelles
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Redact les champs sensibles automatiquement
    redact: {
      paths: [
        'authorization',
        '*.authorization',
        '*.token',
        '*.api_key',
        '*.secret',
        '*.password',
        'req.headers.authorization',
      ],
      censor: '[REDACTED]',
    },
  },
  process.env.NODE_ENV !== 'production'
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      })
    : undefined
)
