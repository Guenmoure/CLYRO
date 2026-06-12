'use client'

/**
 * Confirmation dialog built on top of the shared Modal.
 * Used wherever a destructive (or otherwise irreversible) action needs an
 * explicit confirmation step — e.g. hard-deleting a project or a folder.
 */

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Called when the user confirms. May be async — the confirm button shows a spinner until it settles. */
  onConfirm: () => Promise<void> | void
  title: string
  message: React.ReactNode
  /** Defaults to the localized "Delete". */
  confirmLabel?: string
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string
  /** Visual style of the confirm button. Defaults to the destructive variant. */
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!busy) onClose() }}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={variant} loading={busy} onClick={handleConfirm}>
            {confirmLabel ?? t('delete')}
          </Button>
        </>
      }
    >
      <p className="font-body text-sm text-[--text-secondary]">{message}</p>
    </Modal>
  )
}
