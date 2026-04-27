import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

  let body: { title?: unknown; folder_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.title === 'string') {
    const trimmed = body.title.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    if (trimmed.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    }
    patch.title = trimmed
  }

  // folder_id may be present as null (unfile) or as a uuid (move).
  // Distinguish "explicitly set to null" vs "not provided" via hasOwnProperty.
  if (Object.prototype.hasOwnProperty.call(body, 'folder_id')) {
    const fid = body.folder_id
    if (fid === null) {
      patch.folder_id = null
    } else if (typeof fid === 'string' && fid.length > 0) {
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
    } else {
      return NextResponse.json({ error: 'folder_id must be a uuid or null' }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
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
