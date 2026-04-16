import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL        ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY       ?? ''

/**
 * Beacon endpoint — called by navigator.sendBeacon() on tab close.
 * Uses the service-role key so we can bypass RLS while still verifying
 * the user via their JWT passed in the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { draftId, module, title, style, currentStep, state } = JSON.parse(body) as {
      draftId:     string
      module:      string
      title:       string
      style:       string
      currentStep: number
      state:       Record<string, unknown>
    }

    if (!draftId) return NextResponse.json({ ok: false }, { status: 400 })

    // Use service role to update without cookie session (sendBeacon may not send cookies)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: 'Missing env' }, { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    await supabase
      .from('videos')
      .update({
        title:        title || 'Sans titre',
        style:        style || 'draft',
        module,
        wizard_step:  currentStep + 1,
        wizard_state: state,
        status:       'draft',
        updated_at:   new Date().toISOString(),
      })
      .eq('id', draftId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
