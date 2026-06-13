/**
 * nav-model — two-level navigation model (HeyGen pattern).
 *
 * Each RAIL entry maps to a real route. Entries with `children` render a
 * contextual PANEL to the right of the icon rail; the panel lists sub-links,
 * optionally grouped by an uppercase `groupKey` heading.
 *
 * All labels are translation keys (resolved via t() in the consumer).
 * Routes are verified against the real app/(dashboard) folder tree — no
 * invented routes.
 *
 * `isModule: true` marks a creation module: its panel shows a full-width
 * "+ Create new" button that routes to `<href>/new`.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Home, Video, Sparkles, Clapperboard, Palette, Rocket,
  FolderOpen, Settings,
} from 'lucide-react'

export interface NavChild {
  labelKey: string
  href:     string
  /** Uppercase group heading key — children sharing one render under it. */
  groupKey?: string
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

/** Primary rail — top group. */
export const RAIL_ITEMS: NavEntry[] = [
  {
    id: 'home',
    icon: Home,
    labelKey: 'nav_home',
    href: '/dashboard',
    // No children → no panel, full-width content.
  },
  {
    id: 'faceless',
    icon: Video,
    labelKey: 'facelessVideos',
    href: '/faceless',
    isModule: true,
    children: [
      { labelKey: 'nav_new',      href: '/faceless/new' },
      { labelKey: 'nav_myVideos', href: '/faceless', groupKey: 'nav_grp_manage' },
    ],
  },
  {
    id: 'motion',
    icon: Sparkles,
    labelKey: 'motionDesign',
    href: '/motion',
    isModule: true,
    children: [
      { labelKey: 'nav_new',      href: '/motion/new' },
      { labelKey: 'nav_myMotion', href: '/motion', groupKey: 'nav_grp_manage' },
    ],
  },
  {
    id: 'studio',
    icon: Clapperboard,
    labelKey: 'aiAvatarStudio',
    href: '/studio',
    isModule: true,
    children: [
      { labelKey: 'nav_new',       href: '/studio/new' },
      { labelKey: 'nav_myProjects', href: '/studio', groupKey: 'nav_grp_manage' },
    ],
  },
  {
    id: 'brand',
    icon: Palette,
    labelKey: 'brandKit',
    href: '/brand',
    isModule: true,
    children: [
      { labelKey: 'nav_new',  href: '/brand/new' },
      { labelKey: 'nav_kits', href: '/brand', groupKey: 'nav_grp_manage' },
    ],
  },
  {
    id: 'autopilot',
    icon: Rocket,
    labelKey: 'npd_autopilot_title',
    href: '/autopilot',
    // Single page, no panel.
  },
  {
    id: 'library',
    icon: FolderOpen,
    labelKey: 'nav_library',
    href: '/projects',
    children: [
      { labelKey: 'projects',  href: '/projects',  groupKey: 'nav_grp_library' },
      { labelKey: 'dr_title',  href: '/drafts',    groupKey: 'nav_grp_library' },
      { labelKey: 'templates', href: '/templates', groupKey: 'nav_grp_library' },
      { labelKey: 'assets',    href: '/assets',    groupKey: 'nav_grp_library' },
      { labelKey: 'voices',    href: '/voices',    groupKey: 'nav_grp_library' },
    ],
  },
]

/** Bottom rail — workspace / settings. */
export const RAIL_BOTTOM_ITEMS: NavEntry[] = [
  {
    id: 'settings',
    icon: Settings,
    labelKey: 'settings',
    href: '/settings',
    children: [
      { labelKey: 'general',      href: '/settings' },
      { labelKey: 'billing',      href: '/settings/billing',      groupKey: 'nav_grp_workspace' },
      { labelKey: 'brandKit',     href: '/settings/brand',        groupKey: 'nav_grp_workspace' },
      { labelKey: 'nav_team',     href: '/settings/team',         groupKey: 'nav_grp_workspace' },
      { labelKey: 'nav_integrations', href: '/settings/integrations', groupKey: 'nav_grp_workspace' },
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
 * resolves to settings, /faceless/new resolves to faceless, etc.
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
 * Longest-matching href wins, so /faceless/new activates "New" while
 * /faceless activates "My videos" — without both lighting up.
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
