'use client'

import { BrandSidebar } from './BrandSidebar'

interface BrandKitLayoutProps {
  kitId: string
  kitName?: string
  /** Optional save indicator (« Saved · 2s ago » ou « Saving… »). */
  saveStatus?: React.ReactNode
  /** Onglets contextuels affichés à droite du titre (ex. Brand Overview / Business Details). */
  tabs?: React.ReactNode
  children: React.ReactNode
}

/**
 * Layout commun à toutes les sous-pages du module Brand Kit :
 *   sidebar à icônes (BrandSidebar) | header (titre + tabs + save status) | content
 *
 * Le contenu défile, le sidebar et le header restent fixes.
 */
export function BrandKitLayout({ kitId, kitName, saveStatus, tabs, children }: BrandKitLayoutProps) {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <BrandSidebar kitId={kitId} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-foreground truncate">
              {kitName ?? 'Brand Kit'}
            </h1>
            {tabs && <div className="mt-2">{tabs}</div>}
          </div>
          {saveStatus && (
            <div className="shrink-0 font-mono text-[11px] text-[--text-muted]">
              {saveStatus}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
