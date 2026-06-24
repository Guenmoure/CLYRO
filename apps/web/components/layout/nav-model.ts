/**
 * nav-model — two-level navigation model.
 *
 * Audit 19/06/26 — reorganised per stakeholder direction :
 *
 *   Logo (CLYRO) → /dashboard      (acts as Home; no separate Home entry)
 *   1. Anim Video                  (ex-Faceless, standalone, no panel)
 *   2. Studio                      → Motion Design · AI Avatar Studio · Brand
 *   3. Apps                        → catalogue of ALL apps (Anim + Studio's 3 + Autopilot)
 *   4. Assets                      → Avatars · Voices · Templates
 *   5. Projects                    → All projects · Drafts
 *
 * Settings is NO LONGER on the rail — it lives in the user-profile dropdown
 * only (Sidebar.userMenu). Same goes for Billing / Help.
 *
 * Each RAIL entry maps to a real route. Entries with `children` render a
 * contextual PANEL to the right of the icon rail; the panel lists sub-links,
 * optionally grouped by an uppercase `groupKey` heading.
 *
 * All labels are translation keys (resolved via t() in the consumer). Routes
 * are verified against the real app/(dashboard) folder tree.
 *
 * `isModule: true` marks a creation module: its panel shows a full-width
 * "+ Create new" button that routes to `<href>/new`.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Wand2, Clapperboard, LayoutGrid,
  Boxes, FolderOpen,
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

// ── Primary rail — 5 entries (no Home, no Settings) ─────────────────────────

/** Primary rail — top group. */
export const RAIL_ITEMS: NavEntry[] = [
  // ── 1. Anim Video — standalone Faceless module ────────────────────────────
  // No children: clicking goes straight to /faceless. The dedicated « New »
  // route is reached via the page-level CTA (no panel needed).
  {
    id: 'anim',
    icon: Wand2,
    labelKey: 'nav_animVideo',
    href: '/faceless',
    isModule: true,
  },

  // ── 2. Studio — three creation tools grouped under one rail entry ─────────
  {
    id: 'studio',
    icon: Clapperboard,
    labelKey: 'nav_studio',
    href: '/studio',
    children: [
      { labelKey: 'nav_motionDesign',  href: '/motion',  groupKey: 'nav_grp_tools' },
      { labelKey: 'nav_avatarStudio',  href: '/studio',  groupKey: 'nav_grp_tools' },
      { labelKey: 'nav_brand',         href: '/brand',   groupKey: 'nav_grp_tools' },
    ],
  },

  // ── 3. Apps — catalogue of every creative app (discovery hub) ─────────────
  {
    id: 'apps',
    icon: LayoutGrid,
    labelKey: 'nav_apps',
    href: '/apps',
    children: [
      { labelKey: 'nav_animVideo',       href: '/faceless',  groupKey: 'nav_grp_create' },
      { labelKey: 'nav_motionDesign',    href: '/motion',    groupKey: 'nav_grp_create' },
      { labelKey: 'nav_avatarStudio',    href: '/studio',    groupKey: 'nav_grp_create' },
      { labelKey: 'nav_brand',           href: '/brand',     groupKey: 'nav_grp_create' },
      { labelKey: 'npd_autopilot_title', href: '/autopilot', groupKey: 'nav_grp_create' },
    ],
  },

  // ── 4. Assets — Avatars / Voices / Templates ──────────────────────────────
  {
    id: 'assets',
    icon: Boxes,
    labelKey: 'nav_assets',
    href: '/assets',
    children: [
      { labelKey: 'nav_avatars',   href: '/assets/avatars', groupKey: 'nav_grp_library' },
      { labelKey: 'nav_voices',    href: '/assets/voices',  groupKey: 'nav_grp_library' },
      { labelKey: 'nav_templates', href: '/templates',      groupKey: 'nav_grp_library' },
    ],
  },

  // ── 5. Projects — all generated content ───────────────────────────────────
  {
    id: 'projects',
    icon: FolderOpen,
    labelKey: 'nav_projects',
    href: '/projects',
    children: [
      { labelKey: 'nav_allProjects', href: '/projects' },
      { labelKey: 'nav_drafts',      href: '/drafts', groupKey: 'nav_grp_library' },
    ],
  },
]

/**
 * Bottom rail — intentionally empty.
 * Settings + Billing + Help are reachable via the user-profile dropdown
 * (Sidebar.userMenu) per the 19/06/26 navigation overhaul. Kept exported as
 * an empty array so the existing Sidebar / mobile-drawer iteration code keeps
 * compiling without conditionals.
 */
export const RAIL_BOTTOM_ITEMS: NavEntry[] = []

export const ALL_RAIL_ITEMS: NavEntry[] = [...RAIL_ITEMS, ...RAIL_BOTTOM_ITEMS]

/** Rail width and panel width (px) — consumed by the shell for content offset. */
export const RAIL_W  = 72
export const PANEL_W = 210

/**
 * Resolve which rail entry owns the current pathname.
 * Matches the most specific entry (longest href prefix) so /faceless/new
 * resolves to Anim, /studio/new resolves to Studio, etc.
 *
 * Returns undefined for /dashboard (the logo handles its active state) and
 * for any path that isn't covered — the caller decides what to do.
 */
export function resolveActiveEntry(pathname: string): NavEntry | undefined {
  // Dashboard belongs to the logo, not the rail.
  if (pathname === '/dashboard') return undefined

  let best: NavEntry | undefined
  let bestLen = -1
  for (const entry of ALL_RAIL_ITEMS) {
    const hrefs = [entry.href, ...(entry.children?.map(c => c.href) ?? [])]
    for (const href of hrefs) {
      const match = pathname === href || pathname.startsWith(href + '/')
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
 * Longest-matching href wins, so /faceless/new activates the Anim entry
 * but no child (Anim has none), while /assets/voices activates Voices.
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
