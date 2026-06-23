/**
 * nav-model — editorial table-of-contents navigation.
 *
 * Audit 23/06/26 — reworked to match the CLYRO editorial handoff
 * (May 2026). The previous icon-rail+panel is replaced with a single-column
 * TOC : masthead → grouped sections → roman-numeral items. No Dashboard
 * section per stakeholder direction ; the logo (top of the rail) still
 * routes to /dashboard for the prompt-first home.
 *
 * Three sections :
 *   CREATE  — Anim · Avatar Studio · Motion Design · Brand
 *   LIBRARY — Projects · Avatars · Voices · Templates
 *   ACCOUNT — Profile · Billing · Team · Preferences
 *
 * Each item carries a roman numeral (I … XII). All labels are translation
 * keys resolved by the consumer via t().
 */

import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  /** Stable id (used for active-state computation + analytics). */
  id:       string
  /** Roman numeral shown left of the label (`I`, `II`, …). */
  numeral:  string
  /** Translation key for the visible label. */
  labelKey: string
  /** Target href in the app. */
  href:     string
}

export interface NavSection {
  /** Stable id (used as React key). */
  id:        string
  /** Translation key for the small uppercase section header. */
  labelKey:  string
  items:     NavItem[]
}

/**
 * The three editorial sections. Order = visual order.
 * Numerals are pre-computed so renumbering is a single change here.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id:       'create',
    labelKey: 'nav_sec_create',
    items: [
      { id: 'anim',     numeral: 'I',   labelKey: 'nav_animVideo',    href: '/faceless' },
      { id: 'studio',   numeral: 'II',  labelKey: 'nav_avatarStudio', href: '/studio'   },
      { id: 'motion',   numeral: 'III', labelKey: 'nav_motionDesign', href: '/motion'   },
      { id: 'brand',    numeral: 'IV',  labelKey: 'nav_brand',        href: '/brand'    },
    ],
  },
  {
    id:       'library',
    labelKey: 'nav_sec_library',
    items: [
      { id: 'projects',  numeral: 'V',    labelKey: 'nav_projects',  href: '/projects'        },
      { id: 'avatars',   numeral: 'VI',   labelKey: 'nav_avatars',   href: '/assets/avatars'  },
      { id: 'voices',    numeral: 'VII',  labelKey: 'nav_voices',    href: '/assets/voices'   },
      { id: 'templates', numeral: 'VIII', labelKey: 'nav_templates', href: '/templates'       },
    ],
  },
  {
    id:       'account',
    labelKey: 'nav_sec_account',
    items: [
      { id: 'profile',     numeral: 'IX',  labelKey: 'nav_profile',     href: '/settings'              },
      { id: 'billing',     numeral: 'X',   labelKey: 'billing',         href: '/settings/billing'      },
      { id: 'team',        numeral: 'XI',  labelKey: 'nav_team',        href: '/settings/team'         },
      { id: 'integrations', numeral: 'XII', labelKey: 'nav_integrations', href: '/settings/integrations' },
    ],
  },
]

/** Flat list — handy for active-state lookups. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)

/**
 * Resolve which nav item owns the current pathname.
 * /dashboard returns undefined — the logo handles its own highlight.
 */
export function resolveActiveItemId(pathname: string): string | undefined {
  if (pathname === '/dashboard') return undefined
  let best: NavItem | undefined
  let bestLen = -1
  for (const item of ALL_NAV_ITEMS) {
    const match = pathname === item.href || pathname.startsWith(item.href + '/')
    if (match && item.href.length > bestLen) {
      best = item
      bestLen = item.href.length
    }
  }
  return best?.id
}

/* ── Legacy exports kept temporarily for files that still import the old
 *    nav model. Each maps to a shape the consumer expects.
 *    TODO Vague 2 : remove these once Sidebar.tsx is the only consumer. */

/** @deprecated Use NAV_SECTIONS. Kept for backward-compat. */
export interface NavEntry {
  id:       string
  icon:     LucideIcon | (() => null)
  labelKey: string
  href:     string
  isModule?: boolean
  children?: { labelKey: string; href: string; groupKey?: string }[]
}

/** @deprecated Use NAV_SECTIONS. Empty array — old shell.tsx loops over it. */
export const RAIL_ITEMS: NavEntry[] = []
/** @deprecated */
export const RAIL_BOTTOM_ITEMS: NavEntry[] = []
/** @deprecated */
export const ALL_RAIL_ITEMS: NavEntry[] = []

/** Sidebar dimensions — single column now. */
export const RAIL_W  = 0
export const PANEL_W = 268
export const SIDEBAR_W = 268

/** @deprecated Use resolveActiveItemId. */
export function resolveActiveEntry(_pathname: string): NavEntry | undefined {
  return undefined
}
/** @deprecated */
export function resolveActiveChildHref(_entry: NavEntry, _pathname: string): string | undefined {
  return undefined
}
