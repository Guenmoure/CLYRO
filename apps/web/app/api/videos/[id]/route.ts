import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

const patchVideoSchema = z.object({
  title:     z.string().trim().min(1).max(200).optional(),
  folder_id: z.string().uuid().nullable().optional(),
}).refine(d => d.title !== undefined || d.folder_id !== undefined, {
  message: 'No supported fields to update',
})

/**
 * PATCH /api/videos/:id
 *
 * Partial update. Supported fields:
 *   - title:     string                 → rename
 *   - folder_id: string | null          → move to folder, or null = unfile
 *
 * Both fields are optional; you can update one or the other (or both).
 * folder_id ownership is enforced: passing a folder owned by another
 * user returns 400 — Postgres FK alone wouldn't catch cross-user use.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = patchVideoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (parsed.data.title !== undefined) {
    patch.title = parsed.data.title
  }

  // folder_id may be null (unfile) or a uuid (move).
  if (parsed.data.folder_id !== undefined) {
    const fid = parsed.data.folder_id
    if (fid === null) {
      patch.folder_id = null
    } else {
      // Verify the folder belongs to this user before assigning.
      const { data: folder, error: folderErr } = await supabase
        .from('folders')
        .select('id')
        .eq('id', fid)
        .eq('user_id', user.id)
        .maybeSingle()

      if (folderErr || !folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 400 })
      }
      patch.folder_id = fid
    }
  }

  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('videos')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, title, folder_id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Video not found or update failed' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/videos/:id
 *
 * Hard delete — row is removed after ownership check.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership first so we can return a clean 404 instead of a
  // silently-successful delete that removed nothing (Supabase returns no
  // error when the row simply isn't visible to the caller via RLS).
  const { data: existing, error: fetchErr } = await supabase
    .from('videos')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const { error: delErr } = await supabase
    .from('videos')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (delErr) {
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
