import { type NextRequest, NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { z } from 'zod'

const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(80, 'Name too long (max 80 chars)'),
})

/**
 * GET /api/folders
 *
 * Returns the current user's folders, ordered alphabetically.
 * Response: { folders: Array<{ id, name, created_at }> }
 */
export async function GET() {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('folders')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 })
  }

  return NextResponse.json({ folders: data ?? [] })
}

/**
 * POST /api/folders
 *
 * Creates a new folder for the current user.
 * Body: { name: string }
 * Returns the created row, or 409 if a folder with the same name
 * (case-insensitive) already exists.
 */
export async function POST(req: NextRequest) {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = createFolderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: user.id, name: parsed.data.name })
    .select('id, name, created_at')
    .single()

  if (error) {
    // 23505 = unique_violation (Postgres) — collision on the
    // case-insensitive (user_id, lower(name)) index.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
