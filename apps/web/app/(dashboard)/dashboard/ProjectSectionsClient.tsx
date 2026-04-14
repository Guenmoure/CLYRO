'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

// Dynamic import with ssr:false — RecentProjects uses useRouter +
// Supabase realtime, both of which need to run client-side only.
const RecentProjects = dynamic(
  () => import('@/components/dashboard/RecentProjects').then((m) => m.RecentProjects),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="h-10 w-48 bg-navy-800 rounded-full animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-navy-800/50 px-4 py-3 animate-pulse">
              <div className="w-14 h-14 rounded-xl bg-navy-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-navy-700 rounded" />
                <div className="h-3 w-1/3 bg-navy-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  }
)

export default function ProjectSectionsClient(props: ComponentProps<typeof RecentProjects>) {
  return <RecentProjects {...props} />
}
