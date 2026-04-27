import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * PATCH /api/folders/:id
 *
 * Renames a folder. Body: { name: string }.
 * Returns 404 if the folder isn't visible to the caller (RLS or
 * not-yours), 409 on name collision, 200 with the updated row otherwise.
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

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const trimmed = body.name.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }
  if (trimmed.length > 80) {
    return NextResponse.json({ error: 'Name too long (max 80 chars)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('folders')
    .update({ name: trimmed })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, name, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Folder not found or update failed' }, { status: 404 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/folders/:id
 *
 * Deletes the folder. Videos that referenced it have folder_id set
 * to NULL automatically (FK ON DELETE SET NULL).
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

  // Ownership pre-check so we return a clean 404 instead of an
  // ambiguous "no rows affected" success.
  const { data: existing, error: fetchErr } = await supabase
    .from('folders')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const { error: delErr } = await supabase
    .from('folders')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (delErr) {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
