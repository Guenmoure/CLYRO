import { createHmac } from 'crypto'

jest.mock('../lib/supabase')
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { verifyMonerooSignature } from '../services/moneroo'

function makeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyMonerooSignature', () => {
  const secret  = 'test-webhook-secret'
  const rawBody = JSON.stringify({ event: 'payment.success', id: 'pay_123' })

  beforeEach(() => {
    process.env.MONEROO_WEBHOOK_SECRET = secret
  })

  afterEach(() => {
    delete process.env.MONEROO_WEBHOOK_SECRET
  })

  it('returns true for a valid HMAC-SHA256 signature', () => {
    const sig = makeSignature(secret, rawBody)
    expect(verifyMonerooSignature(rawBody, sig)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const sig         = makeSignature(secret, rawBody)
    const tamperedBody = rawBody + ' '
    expect(verifyMonerooSignature(tamperedBody, sig)).toBe(false)
  })

  it('returns false for a wrong signature', () => {
    expect(verifyMonerooSignature(rawBody, 'deadbeef')).toBe(false)
  })

  it('returns false when MONEROO_WEBHOOK_SECRET is not set', () => {
    delete process.env.MONEROO_WEBHOOK_SECRET
    const sig = makeSignature(secret, rawBody)
    expect(verifyMonerooSignature(rawBody, sig)).toBe(false)
  })
})
