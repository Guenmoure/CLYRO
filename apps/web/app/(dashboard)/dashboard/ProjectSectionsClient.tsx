'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

// Dynamic import with ssr:false — les composants client ne s'exécutent pas
// pendant le server render, ce qui évite les crashes SSR de dépendances client
// (useRouter, createBrowserClient Supabase, etc.)
const ProjectSections = dynamic(
  () => import('./ProjectSections').then((m) => m.ProjectSections),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-6 w-48 bg-navy-800 rounded animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="aspect-[4/3] bg-navy-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  }
)

export default function ProjectSectionsClient(props: ComponentProps<typeof ProjectSections>) {
  return <ProjectSections {...props} />
}
