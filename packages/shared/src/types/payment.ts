export type PaymentProvider = 'stripe' | 'moneroo'
export type PaymentStatus = 'pending' | 'success' | 'failed'
export type PaymentCurrency = 'EUR' | 'USD' | 'XOF'

export interface Payment {
  id: string
  user_id: string
  provider: PaymentProvider
  amount: number
  currency: PaymentCurrency
  status: PaymentStatus
  metadata: Record<string, unknown>
  created_at: string
}

export interface CheckoutPayload {
  plan: 'starter' | 'studio'
}

export interface MonerooCheckoutPayload extends CheckoutPayload {
  phone: string
  currency?: PaymentCurrency
}
