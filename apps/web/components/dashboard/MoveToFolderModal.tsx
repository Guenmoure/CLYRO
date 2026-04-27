'use client'

import { useEffect, useState } from 'react'
import { Folder, FolderOpen, FolderPlus, Loader2, Check, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FolderRow {
  id: string
  name: string
  created_at?: string
}

interface MoveToFolderModalProps {
  isOpen: boolean
  onClose: () => void
  /** Video to move. */
  videoId: string
  /** Current folder id (null/undefined = unfiled). Used to mark the row. */
  currentFolderId?: string | null
  /** Called after a successful move. The new folder is null when the user
   *  chose "no folder", or a FolderRow when they picked one. */
  onMoved?: (newFolder: FolderRow | null) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function MoveToFolderModal({
  isOpen,
  onClose,
  videoId,
  currentFolderId,
  onMoved,
}: MoveToFolderModalProps) {
  const { t } = useLanguage()

  const [folders,    setFolders]    = useState<FolderRow[] | null>(null)
  const [loadError,  setLoadError]  = useState(false)
  const [selected,   setSelected]   = useState<string | null>(currentFolderId ?? null)
  const [creating,   setCreating]   = useState(false)
  const [newName,    setNewName]    = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load folders when the modal opens.
  useEffect(() => {
    if (!isOpen) return
    setLoadError(false)
    setFolders(null)
    setSelected(currentFolderId ?? null)
    setShowCreate(false)
    setNewName('')

    let cancelled = false
    fetch('/api/folders', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load')
        const json = await res.json() as { folders: FolderRow[] }
        if (!cancelled) setFolders(json.folders)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })

    return () => { cancelled = true }
  }, [isOpen, currentFolderId])

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/folders', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail?.error || 'create')
      }
      const created = await res.json() as FolderRow
      setFolders((prev) => prev ? [...prev, created].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ) : [created])
      setSelected(created.id)
      setNewName('')
      setShowCreate(false)
      toast.success(t('move_createSuccess'))
    } catch {
      toast.error(t('move_createError'))
    } finally {
      setCreating(false)
    }
  }

  async function handleSubmit() {
    if (submitting) return
    // No-op if user picked the same folder they're already in.
    const currentNorm = currentFolderId ?? null
    if (selected === currentNorm) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ folder_id: selected }),
      })
      if (!res.ok) throw new Error('move')
      const folder = selected
        ? (folders?.find((f) => f.id === selected) ?? null)
        : null
      toast.success(
        folder
          ? t('move_success').replace('{name}', folder.name)
          : t('move_unfileSuccess')
      )
      onMoved?.(folder)
      onClose()
    } catch {
      toast.error(t('move_error'))
    } finally {
      setSubmitting(false)
    }
  }

  // Disable submit when nothing actually changes.
  const currentNorm = currentFolderId ?? null
  const dirty = selected !== currentNorm

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('move_title')} size="md">
      <div className="flex flex-col gap-4">

        {/* Section: pick destination */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">
            {t('move_pickFolder')}
          </p>

          {folders === null && !loadError && (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-[--text-muted]">
              <Loader2 size={14} className="animate-spin" />
              {t('move_loading')}
            </div>
          )}

          {loadError && (
            <p className="font-body text-sm text-error py-4 text-center">
              {t('move_loadError')}
            </p>
          )}

          {folders !== null && !loadError && (
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-1">
              {/* "No folder" row — always present */}
              <FolderRowButton
                icon={<FolderOpen size={15} className="text-[--text-muted]" />}
                label={t('move_noFolder')}
                hint={currentNorm === null ? t('move_currentLocation') : undefined}
                active={selected === null}
                onClick={() => setSelected(null)}
              />

              {folders.length === 0 && (
                <p className="font-body text-xs text-[--text-muted] px-3 py-3 text-center">
                  {t('move_empty')}
                </p>
              )}

              {folders.map((f) => (
                <FolderRowButton
                  key={f.id}
                  icon={<Folder size={15} className="text-blue-400" />}
                  label={f.name}
                  hint={currentNorm === f.id ? t('move_currentLocation') : undefined}
                  active={selected === f.id}
                  onClick={() => setSelected(f.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section: create new folder */}
        <div className="border-t border-border/40 pt-4">
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 font-body text-sm text-foreground hover:text-blue-400 transition-colors"
            >
              <FolderPlus size={14} /> {t('move_newFolder')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
                  if (e.key === 'Escape') { setShowCreate(false); setNewName('') }
                }}
                placeholder={t('move_createFolderPlaceholder')}
                maxLength={80}
                className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t('move_create')}
              </Button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('move_cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!dirty || submitting || folders === null}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {t('move_action')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Row sub-component ────────────────────────────────────────────────────────

function FolderRowButton({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        active
          ? 'bg-blue-500/10 border border-blue-500/30'
          : 'hover:bg-card border border-transparent',
      )}
      aria-pressed={active}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-body text-sm text-foreground truncate">
          {label}
        </span>
        {hint && (
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">
            {hint}
          </span>
        )}
      </span>
      {active && <Check size={14} className="text-blue-400 shrink-0" aria-hidden="true" />}
    </button>
  )
}
