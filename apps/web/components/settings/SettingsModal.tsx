'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X, User, Settings2, BookOpen, Cog, CreditCard, Activity,
  Lock, Code, Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AccountSection } from './sections/AccountSection'
import { PreferencesSection } from './sections/PreferencesSection'
import { PlanBillingSection } from './sections/PlanBillingSection'
import { ConnectionsSection } from './sections/ConnectionsSection'
import { UsageHistorySection } from './sections/UsageHistorySection'
import { GeneralSection } from './sections/GeneralSection'
import { PersonalizationSection } from './sections/PersonalizationSection'
import { SecuritySection } from './sections/SecuritySection'
import { ApiSection } from './sections/ApiSection'

// ── Sections definition ───────────────────────────────────────────────────────

export type SettingsSectionId =
  | 'account' | 'preferences' | 'personalization'
  | 'general' | 'billing' | 'usage' | 'security' | 'api' | 'connections'

interface SettingsNavItem {
  id: SettingsSectionId
  label: string
  icon: React.ElementType
}

const PROFILE_SECTIONS: SettingsNavItem[] = [
  { id: 'account',         label: 'Compte',         icon: User      },
  { id: 'preferences',     label: 'Préférences',    icon: Settings2 },
  { id: 'personalization', label: 'Personnalisation', icon: BookOpen },
]

const WORKSPACE_SECTIONS: SettingsNavItem[] = [
  { id: 'general',     label: 'Général',          icon: Cog        },
  { id: 'billing',     label: 'Plan & Facturation', icon: CreditCard },
  { id: 'usage',       label: 'Usage & Historique', icon: Activity },
  { id: 'security',    label: 'Sécurité',         icon: Lock       },
  { id: 'api',         label: 'API',              icon: Code       },
  { id: 'connections', label: 'Connexions',       icon: Plug       },
]

// ── Modal ─────────────────────────────────────────────────────────────────────

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: SettingsSectionId
}

export function SettingsModal({
  open, onOpenChange, initialSection = 'account',
}: SettingsModalProps) {
  const [active, setActive] = useState<SettingsSectionId>(initialSection)

  // Reset to initial section when modal opens
  useEffect(() => {
    if (open) setActive(initialSection)
  }, [open, initialSection])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-fade-in" />

        {/* Content is a full-viewport flex wrapper — no transforms on it, so the
            inner box is perfectly centered regardless of window size. */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Paramètres</Dialog.Title>

          {/* Actual modal box — animation lives HERE, not on the wrapper */}
          <div className="w-full h-full max-w-[1100px] max-h-[760px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-fade-up">
            {/* Left sidebar nav */}
            <aside className="shrink-0 w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/30 overflow-y-auto">
              <nav className="p-4 space-y-5">
                <SectionGroup label="Profil" items={PROFILE_SECTIONS} active={active} onSelect={setActive} />
                <SectionGroup label="Workspace" items={WORKSPACE_SECTIONS} active={active} onSelect={setActive} />
              </nav>
            </aside>

            {/* Right content */}
            <main className="flex-1 overflow-y-auto relative">
              {/* Close button */}
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fermer"
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[--text-secondary] hover:bg-muted hover:text-foreground transition-colors z-10"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>

              <div className="px-8 py-8">
                <SectionContent active={active} />
              </div>
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Section group (nav list) ──────────────────────────────────────────────────

function SectionGroup({
  label, items, active, onSelect,
}: {
  label: string
  items: SettingsNavItem[]
  active: SettingsSectionId
  onSelect: (id: SettingsSectionId) => void
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] font-semibold px-2 mb-2">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm font-body transition-colors',
                  isActive
                    ? 'bg-blue-500/15 text-foreground font-medium'
                    : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon size={16} className={isActive ? 'text-blue-500' : 'text-[--text-muted]'} />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Section content dispatcher ────────────────────────────────────────────────

function SectionContent({ active }: { active: SettingsSectionId }) {
  switch (active) {
    case 'account':         return <AccountSection />
    case 'preferences':     return <PreferencesSection />
    case 'personalization': return <PersonalizationSection />
    case 'general':         return <GeneralSection />
    case 'billing':         return <PlanBillingSection />
    case 'usage':           return <UsageHistorySection />
    case 'security':        return <SecuritySection />
    case 'api':             return <ApiSection />
    case 'connections':     return <ConnectionsSection />
  }
}
