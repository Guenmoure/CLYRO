'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

interface DragDropUploaderProps {
  /** Appelée pour chaque fichier validé. Doit gérer l'upload réel. */
  onUpload: (file: File) => Promise<void>
  multiple?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Zone drag-drop d'images. Valide le MIME et la taille avant de passer au
 * handler. Affiche l'état d'upload global (« 2 / 5 uploaded… »).
 */
export function DragDropUploader({ onUpload, multiple = true, disabled = false, className }: DragDropUploaderProps) {
  const { t } = useLanguage()
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      return t('bk_dd_unsupportedType').replace('{type}', file.type || 'unknown')
    }
    if (file.size > MAX_BYTES) {
      return t('bk_dd_tooLarge').replace('{name}', file.name)
    }
    return null
  }, [t])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled) return
    const list = Array.from(files)
    if (list.length === 0) return

    // Validation upfront — un seul fichier invalide arrête tout pour éviter
    // un état partiel difficile à expliquer à l'utilisateur.
    for (const f of list) {
      const v = validate(f)
      if (v) {
        setError(v)
        return
      }
    }

    setError(null)
    setProgress({ done: 0, total: list.length })
    for (let i = 0; i < list.length; i++) {
      try {
        await onUpload(list[i])
        setProgress({ done: i + 1, total: list.length })
      } catch (err) {
        setError(t('bk_dd_uploadFailed').replace('{message}', err instanceof Error ? err.message : 'unknown'))
        break
      }
    }
    setTimeout(() => setProgress(null), 1500)
  }, [disabled, onUpload, validate, t])

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    void handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'rounded-2xl border-2 border-dashed transition-colors p-6 text-center',
        dragging ? 'border-foreground bg-muted' : 'border-border bg-background',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          if (inputRef.current) inputRef.current.value = ''
        }}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3 text-[--text-muted]">
        {progress ? (
          <>
            <Loader2 size={28} className="animate-spin" />
            <p className="font-mono text-xs">
              {t('bk_dd_progress')
                .replace('{done}', String(progress.done))
                .replace('{total}', String(progress.total))}
            </p>
          </>
        ) : (
          <>
            <Upload size={28} />
            <div className="space-y-0.5">
              <p className="font-body text-sm text-foreground">
                {t('bk_dd_dropHere')}{' '}
                <button type="button" onClick={() => inputRef.current?.click()} className="font-medium underline">
                  {t('bk_dd_browse')}
                </button>
              </p>
              <p className="font-mono text-[10px]">{t('bk_dd_hint')}</p>
            </div>
          </>
        )}
        {error && <p className="font-body text-xs text-error">{error}</p>}
      </div>
    </div>
  )
}
