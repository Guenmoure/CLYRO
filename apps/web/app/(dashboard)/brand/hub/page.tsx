import { createSSRClient } from '@/lib/supabase-server'
import { BrandHub } from '@/components/brand/brand-hub'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Brand Hub — CLYRO' }

export default async function BrandHubPage() {
  const supabase = createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Load user's brand kits
  const { data: brandKits } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return <BrandHub initialKits={(brandKits ?? []) as any} />
}
