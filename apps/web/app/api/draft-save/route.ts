import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL         ?? ''
const SUPABASE_ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY    ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY        ?? ''

/**
 * Beacon endpoint — called by `navigator.sendBeacon()` on tab close /
 * refresh. `sendBeacon` cannot attach cookies on cross-origin or
 * session-less unloads, so we accept a Supabase access_token in the
 * request body and verify it server-side.
 *
 * Previously this endpoint used the service-role key to UPDATE the row
 * matching `draftId` with NO auth check whatsoever — anyone who knew (or
 * guessed) a draft UUID could overwrite it. Now: token → resolve user →
 * UPDATE with `eq('id', draftId).eq('user_id', user.id)` so the service
 * key is only ever used after we've confirmed ownership.
 *
 * The frontend hook (`apps/web/hooks/use-draft-save.ts`) is responsible
 * for sending the current session's access_token in `body.accessToken`.
 */
export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: 'Missing env' }, { status: 500 })
    }

    const raw = await req.text()
    const parsed = JSON.parse(raw) as {
      draftId:      string
      accessToken?: string
      module:       string
      title:        string
      style:        string
      currentStep:  number
      state:        Record<string, unknown>
    }
    const { draftId, accessToken, module, title, style, currentStep, state } = parsed

    if (!draftId)     return NextResponse.json({ ok: false, error: 'Missing draftId' },     { status: 400 })
    if (!accessToken) return NextResponse.json({ ok: false, error: 'Missing accessToken' }, { status: 401 })

    // 1) Verify the access_token via the anon client + getUser(jwt).
    //    Returns the auth.users row for this JWT, or null if invalid /
    //    expired. This is the SAME validation Supabase RLS would do.
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const { data: userData, error: userErr } = await anonClient.auth.getUser(accessToken)
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 })
    }
    const userId = userData.user.id

    // 2) Service-role UPDATE scoped to (draftId, userId). If the row
    //    doesn't belong to the resolved user, the eq() pair returns
    //    zero rows updated — UNAUTHORIZED, return 403 instead of silent
    //    success so the client knows the beacon failed.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
    const { count, error: updErr } = await adminClient
      .from('videos')
      .update({
        title:        title || 'Sans titre',
        style:        style || 'draft',
        module,
        wizard_step:  currentStep + 1,
        wizard_state: state,
        status:       'draft',
        updated_at:   new Date().toISOString(),
      }, { count: 'exact' })
      .eq('id', draftId)
      .eq('user_id', userId)

    if (updErr) {
      return NextResponse.json({ ok: false, error: 'DB error' }, { status: 500 })
    }
    if (count === 0) {
      return NextResponse.json({ ok: false, error: 'Draft not found or not owned by user' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
