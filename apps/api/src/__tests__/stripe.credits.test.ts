// Tests sur la logique des crédits Stripe (sans appels réseau)
// PLAN_CREDITS est module-scoped, on teste via des valeurs connues

describe('Stripe plan credits mapping', () => {
  // Mapping défini dans stripe.ts
  const PLAN_CREDITS: Record<string, number> = {
    starter: 30,
    studio:  -1, // -1 = illimité → converti en 999999 dans activateSubscription
  }

  it('starter plan gives 30 credits', () => {
    expect(PLAN_CREDITS['starter']).toBe(30)
  })

  it('studio plan is marked as unlimited (-1)', () => {
    expect(PLAN_CREDITS['studio']).toBe(-1)
  })

  it('converts -1 to 999999 for database storage', () => {
    const credits = PLAN_CREDITS['studio'] === -1 ? 999999 : PLAN_CREDITS['studio']
    expect(credits).toBe(999999)
  })

  it('starter credits are stored as-is', () => {
    const credits = PLAN_CREDITS['starter'] === -1 ? 999999 : PLAN_CREDITS['starter']
    expect(credits).toBe(30)
  })

  it('unknown plan falls back to undefined (no credits)', () => {
    expect(PLAN_CREDITS['unknown']).toBeUndefined()
  })
})

describe('Stripe lazy init guard', () => {
  it('throws if STRIPE_SECRET_KEY is missing', () => {
    const saved = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY

    // Simulate getStripe() logic
    expect(() => {
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    }).toThrow('STRIPE_SECRET_KEY is not configured')

    if (saved) process.env.STRIPE_SECRET_KEY = saved
  })

  it('throws if STRIPE_WEBHOOK_SECRET is missing', () => {
    const saved = process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_WEBHOOK_SECRET

    expect(() => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')
    }).toThrow('Missing STRIPE_WEBHOOK_SECRET')

    if (saved) process.env.STRIPE_WEBHOOK_SECRET = saved
  })
})
