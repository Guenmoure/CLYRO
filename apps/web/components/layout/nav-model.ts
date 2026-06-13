/**
 * nav-model — two-level navigation model (HeyGen pattern).
 *
 * Six primary rail items matching HeyGen's layout:
 *   Home · Studio (Avatar) · Brand · Apps (Create) · Projects · Settings
 *
 * Each RAIL entry maps to a real route. Entries with `children` render a
 * contextual PANEL to the right of the icon rail; the panel lists sub-links,
 * optionally grouped by an uppercase `groupKey` heading.
 *
 * All labels are translation keys (resolved via t() in the consumer).
 * Routes are verified against the real app/(dashboard) folder tree.
 *
 * `isModule: true` marks a creation module: its panel shows a full-width
 * "+ Create new" button that routes to `<href>/new`.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Home, Clapperboard, Palette, LayoutGrid,
  FolderOpen, Settings, Code,
} from 'lucide-react'

export interface NavChild {
  labelKey: string
  href:     string
  /** Uppercase group heading key — children sharing one render under it. */
  groupKey?: string
  /** Optional icon for richer sub-nav display. */
  icon?: LucideIcon
}

export interface NavEntry {
  id:       string
  icon:     LucideIcon
  labelKey: string
  href:     string
  /** Creation module → panel gets a "+ Create new" button to `<href>/new`. */
  isModule?: boolean
  children?: NavChild[]
}

// ── Primary rail — top group (6 items, matching HeyGen) ─────────────────────

/** Primary rail — top group. */
export const RAIL_ITEMS: NavEntry[] = [
  // ── 1. Home — no sub-nav, full-width content ──────────────────────────────
  {
    id: 'home',
    icon: Home,
    labelKey: 'nav_home',
    href: '/dashboard',
  },

  // ── 2. Studio (≈ HeyGen "Avatar") — avatar video creation ─────────────────
  {
    id: 'studio',
    icon: Clapperboard,
    labelKey: 'nav_studio',
    href: '/studio',
    isModule: true,
    children: [
      { labelKey: 'nav_quickCreate',  href: '/studio/new' },
      { labelKey: 'nav_avatars',      href: '/assets/avatars', groupKey: 'nav_grp_manage' },
      { labelKey: 'nav_voices',       href: '/voices',         groupKey: 'nav_grp_manage' },
      { labelKey: 'nav_myProjects',   href: '/studio',         groupKey: 'nav_grp_myVideos' },
    ],
  },

  // ── 3. Brand (≈ HeyGen "Brand") — brand system & templates ────────────────
  {
    id: 'brand',
    icon: Palette,
    labelKey: 'nav_brand',
    href: '/brand',
    isModule: true,
    children: [
      { labelKey: 'nav_brandSystem', href: '/brand' },
      { labelKey: 'nav_kits',       href: '/brand',     groupKey: 'nav_grp_manage' },
      { labelKey: 'nav_catalog',    href: '/brand',     groupKey: 'nav_grp_manage' },
      { labelKey: 'nav_campaigns',  href: '/brand',     groupKey: 'nav_grp_manage' },
    ],
  },

  // ── 4. Apps (≈ HeyGen "Apps") — creation tools library ────────────────────
  {
    id: 'apps',
    icon: LayoutGrid,
    labelKey: 'nav_apps',
    href: '/faceless',
    children: [
      { labelKey: 'npd_faceless_title', href: '/faceless',     groupKey: 'nav_grp_create' },
      { labelKey: 'npd_motion_title',   href: '/motion',       groupKey: 'nav_grp_create' },
      { labelKey: 'npd_autopilot_title', href: '/autopilot',   groupKey: 'nav_grp_create' },
      { labelKey: 'nav_facelessNew',    href: '/faceless/new', groupKey: 'nav_grp_quickStart' },
      { labelKey: 'nav_motionNew',      href: '/motion/new',   groupKey: 'nav_grp_quickStart' },
    ],
  },

  // ── 5. Projects (≈ HeyGen "Projects") — all content ──────────────────────
  {
    id: 'projects',
    icon: FolderOpen,
    labelKey: 'nav_projects',
    href: '/projects',
    children: [
      { labelKey: 'nav_allProjects', href: '/projects' },
      { labelKey: 'nav_drafts',      href: '/drafts',    groupKey: 'nav_grp_library' },
      { labelKey: 'nav_templates',   href: '/templates', groupKey: 'nav_grp_library' },
      { labelKey: 'nav_assets',      href: '/assets',    groupKey: 'nav_grp_library' },
    ],
  },
]

/** Bottom rail — settings. */
export const RAIL_BOTTOM_ITEMS: NavEntry[] = [
  {
    id: 'settings',
    icon: Settings,
    labelKey: 'settings',
    href: '/settings',
    children: [
      { labelKey: 'nav_general',       href: '/settings' },
      { labelKey: 'billing',           href: '/settings/billing',      groupKey: 'nav_grp_workspace' },
      { labelKey: 'nav_team',          href: '/settings/team',         groupKey: 'nav_grp_workspace' },
      { labelKey: 'nav_integrations',  href: '/settings/integrations', groupKey: 'nav_grp_workspace' },
    ],
  },
]

export const ALL_RAIL_ITEMS: NavEntry[] = [...RAIL_ITEMS, ...RAIL_BOTTOM_ITEMS]

/** Rail width and panel width (px) — consumed by the shell for content offset. */
export const RAIL_W  = 72
export const PANEL_W = 210

/**
 * Resolve which rail entry owns the current pathname.
 * Matches the most specific entry (longest href prefix) so /settings/billing
 * resolves to settings, /faceless/new resolves to apps, etc.
 */
export function resolveActiveEntry(pathname: string): NavEntry | undefined {
  let best: NavEntry | undefined
  let bestLen = -1
  for (const entry of ALL_RAIL_ITEMS) {
    const hrefs = [entry.href, ...(entry.children?.map(c => c.href) ?? [])]
    for (const href of hrefs) {
      const match = href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname === href || pathname.startsWith(href + '/')
      if (match && href.length > bestLen) {
        best = entry
        bestLen = href.length
      }
    }
  }
  return best
}

/**
 * Resolve which child of an entry is active for the current pathname.
 * Longest-matching href wins, so /faceless/new activates "New Faceless" while
 * /faceless activates "Faceless Videos" — without both lighting up.
 */
export function resolveActiveChildHref(entry: NavEntry, pathname: string): string | undefined {
  let best: string | undefined
  let bestLen = -1
  for (const child of entry.children ?? []) {
    const match = pathname === child.href || pathname.startsWith(child.href + '/')
    if (match && child.href.length > bestLen) {
      best = child.href
      bestLen = child.href.length
    }
  }
  return best
}
