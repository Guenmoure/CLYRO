import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js')
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const mockGetUser = jest.fn()
;(createClient as jest.Mock).mockReturnValue({
  auth: { getUser: mockGetUser },
})

// Import AFTER mocking
import { authMiddleware } from '../middleware/auth'

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    path: '/test',
    ...overrides,
  } as unknown as Request
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json   = jest.fn().mockReturnThis()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status, json } as unknown as Response, json, status }
}

const next: NextFunction = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SUPABASE_URL              = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

describe('authMiddleware', () => {
  it('returns 401 when no token provided', async () => {
    const req = makeReq()
    const { res, status, json } = makeRes()

    await authMiddleware(req, res, next)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Bearer token is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') })

    const req = makeReq({ headers: { authorization: 'Bearer bad-token' } })
    const { res, status, json } = makeRes()

    await authMiddleware(req, res, next)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TOKEN' })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() with valid Bearer token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@clyro.app' } },
      error: null,
    })

    const req = makeReq({ headers: { authorization: 'Bearer valid-token' } })
    const { res } = makeRes()

    await authMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).userId).toBe('user-123')
    expect((req as any).userEmail).toBe('test@clyro.app')
  })

  it('accepts token via ?token= query param (SSE fallback)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-456', email: 'sse@clyro.app' } },
      error: null,
    })

    const req = makeReq({ query: { token: 'sse-token' } })
    const { res } = makeRes()

    await authMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).userId).toBe('user-456')
  })

  it('returns 500 when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL

    const req = makeReq({ headers: { authorization: 'Bearer some-token' } })
    const { res, status, json } = makeRes()

    await authMiddleware(req, res, next)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONFIG_ERROR' })
    )
  })
})
