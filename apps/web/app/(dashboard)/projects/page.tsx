'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { DraftsSection } from '@/components/dashboard/DraftsSection'
import { toast } from '@/components/ui/toast'
import {
  Search, X, FolderOpen, SlidersHorizontal,
  FolderPlus, Trash2, ChevronDown, Folder,
  ChevronLeft, ChevronRight,
  Video, Clapperboard, Sparkles, Palette, LayoutGrid, PanelLeft,
  MoreVertical, Pencil, Users, Gem, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { id: 'recent', labelKey: 'proj_newest', literal: '' },
  { id: 'oldest', labelKey: 'proj_oldest', literal: '' },
  { id: 'az',     labelKey: '',            literal: 'A-Z' },
  { id: 'za',     labelKey: '',            literal: 'Z-A' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

// Status enum is the canonical 4 values: draft | generating | done | error.
// Legacy values ('pending', 'processing', 'storyboard', 'visuals', 'audio',
// 'assembly', 'animation', 'completed') are still matched under
// 'generating' for backwards-compat with rows created before the enum was
// tightened; new writes only use the canonical 4.
const STATUS_FILTERS = [
  { id: 'all',        labelKey: 'proj_allStatuses', match: null as string[] | null },
  { id: 'draft',      labelKey: 'proj_drafts',      match: ['draft'] },
  { id: 'generating', labelKey: 'proj_processing',  match: ['generating', 'pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly', 'animation'] },
  { id: 'done',       labelKey: 'proj_completed',   match: ['done', 'completed'] },
  { id: 'error',      labelKey: 'proj_failed',      match: ['error'] },
] as const

type StatusFilter = typeof STATUS_FILTERS[number]['id']

// Sub-navigation entries — filter the videos query by module.
// `null` = no filter (All Projects).
const SUB_NAV: Array<{
  id: string; labelKey: string; module: string | null; icon: React.ElementType
}> = [
  { id: 'all',      labelKey: 'proj_allProjects',    module: null,       icon: LayoutGrid   },
  { id: 'faceless', labelKey: 'proj_facelessVideos',  module: 'faceless', icon: Video        },
  { id: 'studio',   labelKey: 'proj_avatarStudio',   module: 'studio',   icon: Clapperboard },
  { id: 'motion',   labelKey: 'proj_motionDesign',   module: 'motion',   icon: Sparkles     },
  { id: 'brand',    labelKey: 'proj_brandKits',      module: 'brand',    icon: Palette      },
]

interface VideoRow {
  id: string
  title: string | null
  module: string | null
  style: string | null
  status: string
  output_url: string | null
  thumbnail_url?: string | null
  created_at: string
  duration_seconds?: number | null
  created_by?: string | null
  folder_id?: string | null
}

interface FolderRow {
  id: string
  name: string
  created_at?: string
}

export default function ProjectsPage() {
  const { t } = useLanguage()
  const [videos,    setVideos]    = useState<VideoRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [page,      setPage]      = useState(0)
  const [hasMore,   setHasMore]   = useState(false)
  const [total,     setTotal]     = useState(0)
  const [sort,      setSort]      = useState<SortOption>('recent')
  const [search,    setSearch]    = useState('')
  // Folders are now persisted in Supabase (table public.folders, migration
  // 20260426000000_folders.sql). Identified by id, displayed by name.
  const [folders,   setFolders]   = useState<FolderRow[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [activeNav, setActiveNav] = useState<string>('all')
  const [navOpen,   setNavOpen]   = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  // activeFolderMenu now holds a folder id (or null when closed).
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null)
  // Folder pending delete confirmation (hard-delete — needs an explicit step).
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null)

  const activeModule = SUB_NAV.find(n => n.id === activeNav)?.module ?? null
  const activeStatusMatch = STATUS_FILTERS.find(s => s.id === statusFilter)?.match ?? null
  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0)

  const fetchVideos = useCallback(async (
    pageIndex: number,
    sortOption: SortOption,
    moduleFilter: string | null,
    statusMatch: readonly string[] | null,
  ) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const from = pageIndex * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      let query = supabase
        .from('videos')
        .select('id, title, module, style, status, output_url, created_at', { count: 'exact' })
        .eq('user_id', session.user.id)
        .neq('status', 'draft')   // drafts shown separately above
        .range(from, to)

      if (moduleFilter) {
        // 'motion' tab covers both legacy DynamicComposition videos AND the
        // current F2 'motion_design' agency-quality output — show both under
        // the same Motion Design product surface.
        if (moduleFilter === 'motion') {
          query = query.in('module', ['motion', 'motion_design'])
        } else {
          query = query.eq('module', moduleFilter as Database['public']['Tables']['videos']['Row']['module'])
        }
      }

      if (statusMatch && statusMatch.length > 0) {
        query = query.in('status', statusMatch as Database['public']['Tables']['videos']['Row']['status'][])
      }

      if (sortOption === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else if (sortOption === 'oldest') {
        query = query.order('created_at', { ascending: true })
      } else if (sortOption === 'az') {
        query = query.order('title', { ascending: true })
      } else if (sortOption === 'za') {
        query = query.order('title', { ascending: false })
      }

      const { data, count, error } = await query
      if (error) {
        console.error('[projects] Supabase query error:', error)
      }
      if (!error && data) {
        setVideos(data as VideoRow[])
        setTotal(count ?? 0)
        setHasMore(to < (count ?? 0) - 1)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset to page 0 whenever any filter / sort changes.
  useEffect(() => {
    setPage(0)
    fetchVideos(0, sort, activeModule, activeStatusMatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, activeNav, statusFilter])

  useEffect(() => {
    fetchVideos(page, sort, activeModule, activeStatusMatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Escape closes any open popover (filter menu, folder menu).
  useEffect(() => {
    if (!filterMenuOpen && !activeFolderMenu) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setFilterMenuOpen(false)
        setActiveFolderMenu(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filterMenuOpen, activeFolderMenu])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

  // ── Folders: persisted via /api/folders ───────────────────────────────
  // Backed by the public.folders table (migration 20260426000000_folders.sql).

  // Initial load on mount.
  useEffect(() => {
    let cancelled = false
    setFoldersLoading(true)
    fetch('/api/folders', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load')
        const json = await res.json() as { folders: FolderRow[] }
        if (!cancelled) setFolders(json.folders)
      })
      .catch(() => { /* keep folders empty; toast would be noisy on first paint */ })
      .finally(() => { if (!cancelled) setFoldersLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleCreateFolder() {
    if (creatingFolder) return
    // Suggest a default name like "Folder 3" if "Folder 1" / "Folder 2" exist.
    const baseIdx = folders.length + 1
    const seed = `Folder ${baseIdx}`
    const name = window.prompt(t('proj_newFolderName') || 'Folder name', seed)
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) return

    setCreatingFolder(true)
    try {
      const res = await fetch('/api/folders', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ name: trimmed }),
      })
      if (res.status === 409) {
        toast.error(t('proj_folderExists'))
        return
      }
      if (!res.ok) throw new Error()
      const created = await res.json() as FolderRow
      setFolders((prev) => [...prev, created].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ))
    } catch {
      toast.error(t('proj_folderCreateError') || 'Could not create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleFolderRename(folder: FolderRow) {
    setActiveFolderMenu(null)
    const next = window.prompt(t('proj_renameFolder'), folder.name)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === folder.name) return

    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ name: trimmed }),
      })
      if (res.status === 409) {
        toast.error(t('proj_folderExists'))
        return
      }
      if (!res.ok) throw new Error()
      const updated = await res.json() as FolderRow
      setFolders((prev) => prev.map((f) => f.id === folder.id ? updated : f)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))
      toast.success(t('proj_folderRenamed'))
    } catch {
      toast.error(t('proj_folderRenameError') || 'Could not rename folder')
    }
  }

  function handleFolderDelete(folder: FolderRow) {
    setActiveFolderMenu(null)
    setFolderToDelete(folder)
  }

  async function confirmFolderDelete() {
    const folder = folderToDelete
    if (!folder) return
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method:      'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setFolders((prev) => prev.filter((f) => f.id !== folder.id))
      toast.success(t('proj_folderDeleted'))
    } catch {
      toast.error(t('proj_folderDeleteError') || 'Could not delete folder')
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return videos
    const q = search.toLowerCase()
    return videos.filter((v) =>
      v.title?.toLowerCase().includes(q) ||
      v.module?.toLowerCase().includes(q) ||
      v.style?.toLowerCase().includes(q)
    )
  }, [videos, search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const activeNavLabelKey = SUB_NAV.find(n => n.id === activeNav)?.labelKey ?? 'proj_projects'

  // Vague 1 — 23/06/26 — editorial Projects layout. The sub-nav becomes a
  // horizontal mono-uppercase tab row instead of a vertical sidebar.
  // navOpen is kept (still referenced lower down for the toggle that no
  // longer renders) so the existing handlers stay functional during the
  // transition. The next pass can remove it entirely.
  void navOpen
  void setNavOpen

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">

        {/* ── Editorial page header ───────────────────────────── */}
        <header className="mb-8">
          <div className="divider-with-num">
            <span className="eyebrow">{t('nav_sec_library')}</span>
            <hr />
            <span className="folio">№ 05 / 12</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <h1 className="h-display">{t(activeNavLabelKey)}</h1>
          </div>
          <p className="lead mt-5">{t('proj_lead')}</p>
          <hr className="rule-thin mt-8" />
        </header>

        {/* ── Brouillons ───────────────────────────────────────── */}
        <DraftsSection />

        <div className="mt-8 space-y-6">

          {/* ── Editorial tabs (horizontal, mono uppercase) ───── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="ed-tabs" role="tablist" aria-label={t('proj_projects')}>
              {SUB_NAV.map((item) => {
                const active = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveNav(item.id)}
                    className={cn('ed-tab', active && 'active')}
                  >
                    {t(item.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Filter / search / sort row ──────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('proj_searchPlaceholder')}
                  aria-label={t('proj_searchPlaceholder')}
                  className="w-full pl-9 pr-9 py-2 rounded-full border border-border bg-card font-mono text-[11px] text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-foreground transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort — editorial pill style */}
              <label className="rounded-full border border-border bg-card px-4 py-2 font-mono text-[11px] flex items-center gap-2 text-foreground shrink-0 cursor-pointer hover:border-foreground transition-colors">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  aria-label="Sort projects"
                  className="bg-transparent text-foreground focus:outline-none cursor-pointer appearance-none font-mono text-[11px] tracking-wide"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.labelKey ? t(opt.labelKey) : opt.literal}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="text-[--text-muted] pointer-events-none shrink-0" />
              </label>

              {/* Filters — editorial pill */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Filters"
                  aria-haspopup="menu"
                  aria-expanded={filterMenuOpen}
                  onClick={() => setFilterMenuOpen(v => !v)}
                  className={cn(
                    'rounded-full border border-border bg-card w-9 h-9 flex items-center justify-center text-foreground transition-colors',
                    'hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    activeFiltersCount > 0 && 'ring-2 ring-primary/30',
                  )}
                >
                  <SlidersHorizontal size={13} />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-mono font-bold flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {filterMenuOpen && (
                  <div
                    role="menu"
                    className="absolute top-12 right-0 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-30"
                    onMouseLeave={() => setFilterMenuOpen(false)}
                  >
                    <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
                      {t('proj_status')}
                    </p>
                    <div className="py-1">
                      {STATUS_FILTERS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={statusFilter === opt.id}
                          onClick={() => {
                            setStatusFilter(opt.id)
                            setFilterMenuOpen(false)
                          }}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 text-sm font-body w-full text-left transition-colors',
                            statusFilter === opt.id
                              ? 'text-foreground bg-brand/5'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <span className="flex-1">{t(opt.labelKey)}</span>
                          {statusFilter === opt.id && (
                            <Check size={14} className="text-primary shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                    {activeFiltersCount > 0 && (
                      <>
                        <div className="border-t border-border" />
                        <button
                          type="button"
                          onClick={() => { setStatusFilter('all'); setFilterMenuOpen(false) }}
                          className="w-full px-4 py-2.5 text-sm font-body text-[--text-muted] hover:text-foreground hover:bg-muted text-left transition-colors"
                        >
                          {t('proj_clearFilters')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Folders section — editorial section head ──────── */}
            <section aria-labelledby="folders-heading" className="pt-2">
              <div className="divider-with-num mb-5">
                <span className="eyebrow" id="folders-heading">{t('proj_folders')}</span>
                <hr />
                <span className="folio">{folders.length.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="h-card">{t('proj_folders')}</h2>
                <button
                  type="button"
                  aria-label={t('proj_newFolder')}
                  onClick={handleCreateFolder}
                  disabled={creatingFolder}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:border-foreground font-mono text-[10px] uppercase tracking-[0.1em] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderPlus size={11} aria-hidden="true" />
                  {t('proj_newFolder')}
                </button>
              </div>

              {foldersLoading ? (
                <p className="text-xs text-[--text-muted] font-mono">{t('move_loading')}</p>
              ) : folders.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {folders.map((folder) => {
                    const isSelected = activeFolderMenu === folder.id
                    return (
                      <div
                        key={folder.id}
                        className={cn(
                          'group relative rounded-2xl border bg-card transition-colors',
                          isSelected
                            ? 'border-brand/60 ring-2 ring-brand/20'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <Folder
                            size={20}
                            className={cn(
                              'shrink-0 transition-colors',
                              isSelected ? 'text-primary' : 'text-[--text-muted] group-hover:text-foreground',
                            )}
                            aria-hidden="true"
                          />
                          <span className="font-body text-sm text-foreground truncate flex-1 pr-8">{folder.name}</span>
                        </button>

                        {/* 3-dots menu trigger */}
                        <button
                          type="button"
                          aria-label={`Folder "${folder.name}" options`}
                          aria-haspopup="menu"
                          aria-expanded={isSelected}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveFolderMenu(prev => prev === folder.id ? null : folder.id)
                          }}
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 right-3 w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                            'text-[--text-muted] hover:text-foreground hover:bg-muted',
                            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                            isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100',
                          )}
                        >
                          <MoreVertical size={14} aria-hidden="true" />
                        </button>

                        {/* Folder context menu */}
                        {isSelected && (
                          <div
                            role="menu"
                            className="absolute top-full right-0 mt-1 w-52 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-20"
                            onMouseLeave={() => setActiveFolderMenu(null)}
                          >
                            <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
                              {t('proj_folder')}
                            </p>
                            <div className="py-1">
                              <button
                                type="button"
                                disabled
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-body text-[--text-muted] w-full text-left cursor-not-allowed"
                                aria-disabled="true"
                              >
                                <Users size={14} aria-hidden="true" />
                                <span>{t('proj_collaborate')}</span>
                                <Gem size={12} className="text-warning ml-auto" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleFolderRename(folder)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-body text-foreground hover:bg-muted transition-colors w-full text-left"
                              >
                                <Pencil size={14} aria-hidden="true" /> {t('proj_rename')}
                              </button>
                            </div>
                            <div className="border-t border-border" />
                            <div className="py-1">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleFolderDelete(folder)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-body text-error hover:bg-error/10 transition-colors w-full text-left"
                              >
                                <Trash2 size={14} aria-hidden="true" /> {t('proj_delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[--text-muted] font-mono">{t('proj_noFolders')}</p>
              )}
            </section>

            {/* ── Videos section — editorial section head ──────── */}
            <section aria-labelledby="videos-heading" className="pt-4">
              <div className="divider-with-num mb-5">
                <span className="eyebrow" id="videos-heading">{t('proj_videos')}</span>
                <hr />
                <span className="folio">
                  {/* Audit 19/06/26 B3 — counter reflects active search */}
                  {search.trim()
                    ? `${filtered.length} / ${total}`
                    : total.toString().padStart(2, '0')}
                </span>
              </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted animate-pulse overflow-hidden border border-border">
                  <div className="aspect-video bg-card" />
                  <div className="p-3 space-y-1.5">
                    <div className="h-4 w-3/4 bg-card rounded" />
                    <div className="h-3 w-1/2 bg-card rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !filtered.length ? (
            <EmptyState
              icon={FolderOpen}
              title={search ? t('proj_noResults').replace('{q}', search) : t('proj_libraryEmpty')}
              description={search ? t('proj_tryDifferent') : t('proj_createFirst')}
              accent="blue"
              size="lg"
              action={!search ? (
                <div className="flex items-center gap-3">
                  <a
                    href="/faceless/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-500 px-4 py-2 font-display text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    {t('proj_newFaceless')}
                  </a>
                  <a
                    href="/motion/new"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 font-display text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {t('proj_motionDesign')}
                  </a>
                </div>
              ) : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((video) => (
                  <ProjectCard key={video.id} project={video} onDeleted={handleDeleted} />
                ))}
              </div>

              {totalPages > 1 && !search && (
                <div className="flex items-center justify-between bg-muted border border-border rounded-xl px-4 py-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={page === 0}
                    className="flex items-center gap-1.5 text-xs font-medium text-[--text-muted] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={14} /> {t('proj_previous')}
                  </button>
                  <span className="text-xs text-[--text-muted] font-mono">
                    {t('proj_page')} {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={!hasMore}
                    className="flex items-center gap-1.5 text-xs font-medium text-[--text-muted] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                  >
                    {t('proj_next')} <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
            </section>

        </div>
        {/* /editorial content */}

      </div>

      {/* Folder delete confirmation */}
      <ConfirmDialog
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={confirmFolderDelete}
        title={t('confirmDelete')}
        message={t('proj_deleteFolderConfirm').replace('{name}', folderToDelete?.name ?? '')}
        confirmLabel={t('delete')}
      />
    </div>
  )
}
