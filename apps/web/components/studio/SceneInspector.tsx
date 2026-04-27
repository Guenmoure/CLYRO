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
}

const ALL_TYPES: StudioSceneType[] = ['avatar', 'split', 'infographic', 'demo', 'typography', 'broll']

export function SceneInspector({ scene, onRegenerate, onDelete, onRestore }: SceneInspectorProps) {
  const { t } = useLanguage()
  const [script, setScript]     = useState(scene?.script ?? '')
  const [feedback, setFeedback] = useState('')
  const [type, setType]         = useState<StudioSceneType>(scene?.type ?? 'avatar')
  const [busy, setBusy]         = useState(false)

  // Sync state when scene changes
  useEffect(() => {
    if (scene) {
      setScript(scene.script)
      setType(scene.type)
      setFeedback('')
    }
  }, [scene])

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
  const dirtyType   = type !== scene.type
  const canRegenerate = !busy && (dirtyScript || dirtyType || feedback.trim().length > 0)

  async function handleRegenerate() {
    if (!onRegenerate || !scene) return
    setBusy(true)
    try {
      await onRegenerate({
        sceneId: scene.id,
        script: dirtyScript ? script : undefined,
        feedback: feedback.trim() || undefined,
        type: dirtyType ? type : undefined,
      })
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Header */}
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
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors resize-y"
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
              const active = tp === type
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setType(tp)}
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
            {SCENE_TYPE_DESCRIPTIONS[type]}
          </p>
        </div>

        {/* Type-specific fields */}
        {(type === 'avatar' || type === 'split') && (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">
              {t('si_avatarVoiceSection')}
            </p>
            <p className="font-body text-xs text-[--text-secondary]">
              {t('si_avatarVoiceInherited')}
            </p>
          </div>
        )}
        {type === 'broll' && (
          <div className="space-y-2">
            <label className="font-body text-xs font-semibold text-foreground">{t('si_pexelsQuery')}</label>
            <input
              type="text"
              value={scene.broll_query ?? ''}
              placeholder={t('si_pexelsPlaceholder')}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
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
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
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
