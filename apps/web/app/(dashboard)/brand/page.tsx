import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { BrandHub } from '@/components/brand/brand-hub'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Brand Kit — CLYRO' }

export default async function BrandPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  // Load user's brand kits
  const { data: brandKits } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return <BrandHub initialKits={brandKits ?? []} />
}
