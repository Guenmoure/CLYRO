import { type NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { z } from 'zod'

const renameFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(80, 'Name too long (max 80 chars)'),
})

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
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = renameFolderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('folders')
    .update({ name: parsed.data.name })
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
  const supabase = createSSRClient()
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
