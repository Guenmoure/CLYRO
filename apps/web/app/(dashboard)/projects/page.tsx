'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
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

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { id: 'recent', labelKey: 'proj_newest', literal: '' },
  { id: 'oldest', labelKey: 'proj_oldest', literal: '' },
  { id: 'az',     labelKey: '',            literal: 'A-Z' },
  { id: 'za',     labelKey: '',            literal: 'Z-A' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

const STATUS_FILTERS = [
  { id: 'all',        labelKey: 'proj_allStatuses', match: null as string[] | null },
  { id: 'done',       labelKey: 'proj_completed',   match: ['done'] },
  { id: 'processing', labelKey: 'proj_processing',  match: ['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly', 'animation'] },
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
        query = query.eq('module', moduleFilter)
      }

      if (statusMatch && statusMatch.length > 0) {
        query = query.in('status', statusMatch)
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

  async function handleFolderDelete(folder: FolderRow) {
    setActiveFolderMenu(null)
    if (!window.confirm(t('proj_deleteFolderConfirm').replace('{name}', folder.name))) return

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

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Brouillons ───────────────────────────────────────── */}
        <DraftsSection />

        {/* ── Two-column layout: sub-nav + content ─────────────── */}
        <div className="mt-8 flex gap-6">

          {/* ── Sub-nav column ──────────────────────────────────── */}
          {navOpen && (
            <aside className="w-56 shrink-0 hidden md:block" aria-label="Project categories">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="font-display text-sm font-semibold text-foreground">{t('proj_projects')}</p>
                <button
                  type="button"
                  aria-label={t('proj_collapseNav')}
                  onClick={() => setNavOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  <PanelLeft size={14} />
                </button>
              </div>
              <nav className="space-y-0.5" role="tablist">
                {SUB_NAV.map((item) => {
                  const Icon = item.icon
                  const active = activeNav === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveNav(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-xl font-body text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
                        active
                          ? 'bg-blue-500/10 text-foreground border border-blue-500/30'
                          : 'text-[--text-muted] hover:text-foreground hover:bg-muted border border-transparent',
                      )}
                    >
                      <Icon size={15} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </button>
                  )
                })}
              </nav>
            </aside>
          )}

          {/* ── Content column ──────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Header row */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {!navOpen && (
                <button
                  type="button"
                  aria-label={t('proj_openNav')}
                  onClick={() => setNavOpen(true)}
                  className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  <PanelLeft size={15} />
                </button>
              )}
              <h1 className="font-display text-2xl font-bold text-foreground shrink-0">{t(activeNavLabelKey)}</h1>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('proj_searchPlaceholder')}
                  aria-label={t('proj_searchPlaceholder')}
                  className="w-full pl-10 pr-9 py-2.5 glass rounded-xl text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sort */}
              <label className={cn('glass rounded-xl px-4 py-2.5 font-body text-sm flex items-center gap-2 text-foreground shrink-0 cursor-pointer')}>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  aria-label="Sort projects"
                  className="bg-transparent text-foreground focus:outline-none cursor-pointer appearance-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.labelKey ? t(opt.labelKey) : opt.literal}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-[--text-muted] pointer-events-none shrink-0" />
              </label>

              {/* Filters */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Filters"
                  aria-haspopup="menu"
                  aria-expanded={filterMenuOpen}
                  onClick={() => setFilterMenuOpen(v => !v)}
                  className={cn(
                    'glass rounded-xl w-11 h-11 flex items-center justify-center text-foreground transition-colors',
                    'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
                    activeFiltersCount > 0 && 'ring-2 ring-blue-500/40',
                  )}
                >
                  <SlidersHorizontal size={15} />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
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
                              ? 'text-foreground bg-blue-500/5'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <span className="flex-1">{t(opt.labelKey)}</span>
                          {statusFilter === opt.id && (
                            <Check size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
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

            {/* ── Folders section ───────────────────────────────── */}
            <section aria-labelledby="folders-heading">
              <div className="flex items-center gap-2 mb-3">
                <h2 id="folders-heading" className="font-display text-base font-semibold text-foreground">{t('proj_folders')}</h2>
                <button
                  type="button"
                  aria-label={t('proj_newFolder')}
                  onClick={handleCreateFolder}
                  disabled={creatingFolder}
                  className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderPlus size={14} aria-hidden="true" />
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
                            ? 'border-blue-500/60 ring-2 ring-blue-500/20'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                        >
                          <Folder
                            size={20}
                            className={cn(
                              'shrink-0 transition-colors',
                              isSelected ? 'text-blue-400' : 'text-[--text-muted] group-hover:text-foreground',
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
                            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
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

            {/* ── Videos section ────────────────────────────────── */}
            <section aria-labelledby="videos-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="videos-heading" className="font-display text-base font-semibold text-foreground">{t('proj_videos')}</h2>
                {!loading && total > 0 && (
                  <span className="text-xs text-[--text-muted] font-mono bg-muted border border-border rounded-full px-3 py-1">
                    {total} video{total > 1 ? 's' : ''}
                  </span>
                )}
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
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/50 border border-dashed border-border rounded-2xl">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border flex items-center justify-center mb-4">
                <FolderOpen size={28} className="text-blue-500" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground mb-2">
                {search ? t('proj_noResults').replace('{q}', search) : t('proj_libraryEmpty')}
              </p>
              <p className="text-sm text-[--text-muted] max-w-sm">
                {search
                  ? t('proj_tryDifferent')
                  : t('proj_createFirst')}
              </p>
              {!search && (
                <div className="flex items-center gap-3 mt-5">
                  <a
                    href="/faceless/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-display text-sm font-semibold text-white hover:opacity-90 transition-opacity"
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
              )}
            </div>
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
                    onClick={() => setPage((p) => p - 1)}
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
                    onClick={() => setPage((p) => p + 1)}
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
          {/* /content column */}
        </div>
        {/* /two-column layout */}

      </div>
    </div>
  )
}
