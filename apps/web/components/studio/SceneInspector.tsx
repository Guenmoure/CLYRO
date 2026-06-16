'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, RotateCcw, Loader2, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type StudioScene, type StudioSceneType,
  SCENE_TYPE_COLORS, SCENE_TYPE_LABELS, SCENE_TYPE_DESCRIPTIONS,
} from '@/lib/studio-types'
import { useLanguage } from '@/lib/i18n'

interface SceneInspectorProps {
  scene: StudioScene | null
  onRegenerate?: (payload: { sceneId: string; script?: string; feedback?: string; type?: StudioSceneType }) => Promise<void>
  onDelete?: (sceneId: string) => Promise<void>
  onRestore?: (sceneId: string, versionIndex: number) => Promise<void>
  /** Audit 16/06/26 W1 — sync the preview badge + timeline thumbnail to the
   *  inspector's type picker without waiting for Regenerate. The parent owns
   *  the scenes array (single source of truth), so it can update the visual
   *  type instantly while still letting the user click Regenerate to commit. */
  onTypeChange?: (sceneId: string, type: StudioSceneType) => void
}

const ALL_TYPES: StudioSceneType[] = ['avatar', 'split', 'infographic', 'demo', 'typography', 'broll']

export function SceneInspector({ scene, onRegenerate, onDelete, onRestore, onTypeChange }: SceneInspectorProps) {
  const { t } = useLanguage()
  const [script, setScript]     = useState(scene?.script ?? '')
  const [feedback, setFeedback] = useState('')
  // We no longer keep a local `type` — the inspector reads `scene.type` from
  // the parent's scenes array so PreviewPlayer + timeline + inspector badge
  // share a single source of truth. We capture the type AT SELECTION TIME
  // to keep the « dirty » flag working (so Regenerate stays enabled after a
  // type change).
  const [originalType, setOriginalType] = useState<StudioSceneType | null>(scene?.type ?? null)
  const [busy, setBusy]         = useState(false)

  // Sync state when the SELECTED scene changes. Depending on `scene?.id`
  // (not the whole object) means optimistic parent updates of the same
  // scene don't reset the originalType snapshot.
  useEffect(() => {
    if (scene) {
      setScript(scene.script)
      setOriginalType(scene.type)
      setFeedback('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id])

  if (!scene) {
    return (
      <aside className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center">
            <Wand2 size={22} className="text-[--text-muted]" />
          </div>
          <p className="font-display text-sm font-semibold text-foreground">{t('si_noSceneTitle')}</p>
          <p className="font-body text-xs text-[--text-secondary] max-w-[220px]">
            {t('si_noSceneDesc')}
          </p>
        </div>
      </aside>
    )
  }

  const dirtyScript = script !== scene.script
  const dirtyType   = originalType !== null && scene.type !== originalType
  const canRegenerate = !busy && (dirtyScript || dirtyType || feedback.trim().length > 0)

  async function handleRegenerate() {
    if (!onRegenerate || !scene) return
    setBusy(true)
    try {
      await onRegenerate({
        sceneId: scene.id,
        script: dirtyScript ? script : undefined,
        feedback: feedback.trim() || undefined,
        type: dirtyType ? scene.type : undefined,
      })
      // After a successful regenerate the parent flips the scene to
      // `regenerating` status; rebase originalType so dirtyType becomes
      // false until the user picks a new type again.
      setOriginalType(scene.type)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Header — reads scene.type directly so the badge matches preview +
            timeline (single source of truth). */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white"
              style={{ backgroundColor: SCENE_TYPE_COLORS[scene.type] }}
            >
              {SCENE_TYPE_LABELS[scene.type]}
            </span>
            <span className="font-display text-sm font-semibold text-foreground">
              {t('si_sceneLabel')} {scene.index + 1}
            </span>
          </div>
          <span className="font-mono text-[10px] text-[--text-muted]">
            {scene.duration_actual ?? scene.duration_est ?? 10}s
          </span>
        </div>

        {/* Script */}
        <div className="space-y-2">
          <label htmlFor="scene-script" className="font-body text-xs font-semibold text-foreground">
            {t('si_scriptLabel')}
          </label>
          <textarea
            id="scene-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-colors resize-y"
            placeholder={t('si_scriptPlaceholder')}
          />
          {dirtyScript && (
            <p className="font-mono text-[10px] text-amber-400">
              {t('si_scriptModified')}
            </p>
          )}
        </div>

        {/* Type switcher */}
        <div className="space-y-2">
          <label className="font-body text-xs font-semibold text-foreground">{t('si_sceneType')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_TYPES.map((tp) => {
              const active = tp === scene.type
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => onTypeChange?.(scene.id, tp)}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all',
                    active
                      ? 'text-white'
                      : 'bg-muted border border-border text-[--text-secondary] hover:text-foreground',
                  )}
                  style={active ? { backgroundColor: SCENE_TYPE_COLORS[tp] } : undefined}
                  aria-pressed={active}
                  title={SCENE_TYPE_DESCRIPTIONS[tp]}
                >
                  {SCENE_TYPE_LABELS[tp]}
                </button>
              )
            })}
          </div>
          <p className="font-body text-[11px] text-[--text-secondary] leading-relaxed">
            {SCENE_TYPE_DESCRIPTIONS[scene.type]}
          </p>
        </div>

        {/* Type-specific fields */}
        {(scene.type === 'avatar' || scene.type === 'split') && (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">
              {t('si_avatarVoiceSection')}
            </p>
            <p className="font-body text-xs text-[--text-secondary]">
              {t('si_avatarVoiceInherited')}
            </p>
          </div>
        )}
        {scene.type === 'broll' && (
          <div className="space-y-2">
            <label className="font-body text-xs font-semibold text-foreground">{t('si_pexelsQuery')}</label>
            <input
              type="text"
              value={scene.broll_query ?? ''}
              placeholder={t('si_pexelsPlaceholder')}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-colors"
              readOnly
            />
            <p className="font-mono text-[10px] text-[--text-muted]">{t('si_pexelsSoon')}</p>
          </div>
        )}

        {/* AI feedback box */}
        <div className="space-y-2">
          <label htmlFor="scene-feedback" className="font-body text-xs font-semibold text-foreground">
            {t('si_aiFeedbackLabel')} <span className="text-[--text-muted] font-normal">({t('si_aiFeedbackOptional')})</span>
          </label>
          <input
            id="scene-feedback"
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t('si_aiFeedbackPlaceholder')}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="primary"
            size="md"
            fullWidth
            leftIcon={busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            disabled={!canRegenerate}
            onClick={handleRegenerate}
          >
            {busy ? t('si_regenerating') : t('si_regenerateScene')}
          </Button>

          {scene.previous_versions.length > 0 && onRestore && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              leftIcon={<RotateCcw size={12} />}
              onClick={() => onRestore(scene.id, 0)}
            >
              {t('si_restorePrevious')}
            </Button>
          )}

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              leftIcon={<Trash2 size={12} />}
              onClick={() => onDelete(scene.id)}
              className="text-error hover:bg-error/10"
            >
              {t('si_deleteScene')}
            </Button>
          )}
        </div>

        {/* Error banner */}
        {scene.status === 'error' && scene.error_message && (
          <div className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 font-mono text-[10px] text-error">
            {scene.error_message}
          </div>
        )}
      </div>
    </aside>
  )
}
