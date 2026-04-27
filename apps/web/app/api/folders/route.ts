import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * GET /api/folders
 *
 * Returns the current user's folders, ordered alphabetically.
 * Response: { folders: Array<{ id, name, created_at }> }
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
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
    .insert({ user_id: user.id, name: trimmed })
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
