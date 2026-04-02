import { z } from 'zod'

// Reproduit la validation du schema cloneVoiceSchema (voices.ts)
// On teste la logique SSRF isolément sans lancer Express
const SUPABASE_HOST = 'wubtpnybgvuocgvsjbbn.supabase.co'

const cloneVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  sample_url: z.string().url().refine((url) => {
    try {
      const { hostname } = new URL(url)
      return hostname === SUPABASE_HOST || hostname.endsWith('.supabase.co')
    } catch {
      return false
    }
  }, 'sample_url must point to Supabase storage'),
})

describe('cloneVoiceSchema — SSRF protection', () => {
  const validUrl = `https://${SUPABASE_HOST}/storage/v1/object/public/audio/test.mp3`

  it('accepts a valid Supabase storage URL', () => {
    const result = cloneVoiceSchema.safeParse({ name: 'Ma voix', sample_url: validUrl })
    expect(result.success).toBe(true)
  })

  it('rejects an external URL (SSRF attempt)', () => {
    const result = cloneVoiceSchema.safeParse({
      name: 'Hack',
      sample_url: 'https://evil.com/audio.mp3',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an internal network URL', () => {
    const result = cloneVoiceSchema.safeParse({
      name: 'Internal',
      sample_url: 'http://169.254.169.254/latest/meta-data/',
    })
    expect(result.success).toBe(false)
  })

  it('rejects localhost', () => {
    const result = cloneVoiceSchema.safeParse({
      name: 'Localhost',
      sample_url: 'http://localhost:4000/sensitive',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a URL that tricks with supabase.co in path', () => {
    const result = cloneVoiceSchema.safeParse({
      name: 'Trick',
      sample_url: 'https://evil.com/supabase.co/audio.mp3',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = cloneVoiceSchema.safeParse({ name: '', sample_url: validUrl })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = cloneVoiceSchema.safeParse({
      name: 'a'.repeat(101),
      sample_url: validUrl,
    })
    expect(result.success).toBe(false)
  })
})
