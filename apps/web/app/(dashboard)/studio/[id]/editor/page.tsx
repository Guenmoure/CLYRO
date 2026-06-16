'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Monitor, Coins } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { StudioTopBar } from '@/components/studio/StudioTopBar'
import { PreviewPlayer } from '@/components/studio/PreviewPlayer'
import { SceneInspector } from '@/components/studio/SceneInspector'
import { TimelineEditor } from '@/components/studio/TimelineEditor'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast'
import { createBrowserClient } from '@/lib/supabase'
import {
  getStudioProject, generateAllStudioScenes, regenerateStudioScene,
  addStudioScene, deleteStudioScene, renderStudioFinal, ApiError,
} from '@/lib/api'
import { useCredits } from '@/hooks/use-credits'
import { creditCostForVideo, type AnimationMode } from '@clyro/shared'
import type {
  StudioProject, StudioScene, StudioSceneType,
} from '@/lib/studio-types'

/** Maps scene type → animation mode for cost estimation (mirrors API). */
const SCENE_TYPE_MODE: Record<StudioSceneType, AnimationMode> = {
  avatar:      'pro',
  split:       'pro',
  infographic: 'fast',
  demo:        'fast',
  typography:  'fast',
  broll:       'storyboard',
}

export const dynamic = 'force-dynamic'

export default function StudioEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useLanguage()
  const projectId = String(params?.id ?? '')

  const [project, setProject]   = useState<StudioProject | null>(null)
  const [scenes, setScenes]     = useState<StudioScene[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null)
  const { credits, isUnlimited, loading: creditsLoading } = useCredits()

  // ── Scroll reset on mount ─────────────────────────────────────────────
  // After script analysis on /studio/new (a long scrollable page), the
  // browser may retain the scroll position when navigating here.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ── Initial fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return
    getStudioProject(projectId)
      .then((data) => {
        setProject(data.project as StudioProject)
        setScenes(data.scenes as StudioScene[])
        if ((data.scenes as StudioScene[]).length > 0) {
          setSelectedId((data.scenes as StudioScene[])[0]!.id)
        }
      })
      .catch((err) => {
        toast.error(t('st_loadProjectFailed'))
        router.push('/dashboard')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, router])

  // ── Realtime: watch scene updates ─────────────────────────────────────

  useEffect(() => {
    if (!projectId) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`studio-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'studio_scenes', filter: `project_id=eq.${projectId}` },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as StudioScene
          setScenes((prev) => prev.map((s) => s.id === updated.id ? updated : s))
          if (updated.status === 'done') toast.success(t('st_sceneReady').replace('{n}', String(updated.index + 1)))
          if (updated.status === 'error') toast.error(t('st_sceneFailed').replace('{n}', String(updated.index + 1)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'studio_projects', filter: `id=eq.${projectId}` },
        (payload: { new: Record<string, unknown> }) => {
          setProject(payload.new as unknown as StudioProject)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Actions ───────────────────────────────────────────────────────────

  const selectedScene = scenes.find((s) => s.id === selectedId) ?? null
  const scenesDone = scenes.filter((s) => s.status === 'done').length
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration_actual ?? s.duration_est ?? 0), 0)

  // Estimated credit cost for all pending scenes
  const estimatedCost = scenes
    .filter((s) => s.status === 'pending')
    .reduce((acc, s) => {
      const dur = s.duration_est ?? 5
      const mode = SCENE_TYPE_MODE[s.type]
      return acc + creditCostForVideo(dur, mode)
    }, 0)
  const canAfford = isUnlimited || credits >= estimatedCost

  const startGeneration = useCallback(async () => {
    if (!project || starting) return
    setStarting(true)
    try {
      await generateAllStudioScenes(project.id)
      toast.success(t('st_generationStarted'))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_CREDITS') {
        toast.error(t('st_insufficientCredits'))
      } else {
        toast.error(t('st_generationStartFailed'))
      }
    } finally {
      setStarting(false)
    }
  }, [project, starting, t])

  const handleRegenerate = useCallback(async (payload: {
    sceneId: string; script?: string; feedback?: string; type?: StudioSceneType
  }) => {
    if (!project) return
    // Optimistically update the scene so the badge + timeline reflect the
    // new type / script immediately, before the Realtime event arrives.
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== payload.sceneId) return s
        return {
          ...s,
          ...(payload.type   ? { type: payload.type }     : {}),
          ...(payload.script ? { script: payload.script } : {}),
          status: 'regenerating' as const,
        }
      }),
    )
    try {
      await regenerateStudioScene({
        projectId: project.id,
        sceneId:   payload.sceneId,
        newScript: payload.script,
        feedback:  payload.feedback,
        newType:   payload.type,
      })
      toast.success(t('st_regenQueued'))
    } catch (err) {
      // Revert the optimistic update on failure — refetch from the server
      // so we don't leave the UI in a stale state.
      try {
        const fresh = await getStudioProject(project.id)
        setScenes(fresh.scenes as StudioScene[])
      } catch { /* Realtime will eventually correct it */ }
      toast.error(t('st_regenFailed'))
    }
  }, [project, t])

  const handleAddScene = useCallback(async (afterIndex: number) => {
    if (!project) return
    try {
      await addStudioScene({ projectId: project.id, afterIndex })
      // Refetch scenes
      const fresh = await getStudioProject(project.id)
      setScenes(fresh.scenes as StudioScene[])
      toast.success(t('st_sceneAdded'))
    } catch (err) {
      toast.error(t('st_sceneAddFailed'))
    }
  }, [project, t])

  const handleDeleteScene = useCallback(async (sceneId: string) => {
    setSceneToDelete(sceneId)
  }, [])

  const confirmDeleteScene = useCallback(async (sceneId: string) => {
    try {
      await deleteStudioScene(sceneId)
      setScenes((prev) => prev.filter((s) => s.id !== sceneId))
      if (selectedId === sceneId) setSelectedId(null)
      toast.success(t('st_sceneDeleted'))
    } catch (err) {
      toast.error(t('st_sceneDeleteFailed'))
    }
  }, [selectedId, t])

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* Mobile guard — the timeline editor is unusable below md, so show
          a full-screen notice instead of a broken layout. */}
      <div className="fixed inset-0 z-50 bg-background flex md:hidden flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="rounded-2xl bg-muted p-4">
          <Monitor size={28} className="text-[--text-muted]" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t('studio_mobileTitle')}
        </h2>
        <p className="font-body text-sm text-[--text-secondary] max-w-xs">
          {t('studio_mobileDesc')}
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 font-display text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {t('st_backToDashboard')}
        </Link>
      </div>

      <StudioTopBar
        projectId={project.id}
        title={project.title}
        status={project.status}
        scenesDone={scenesDone}
        scenesTotal={scenes.length}
        onExport={async () => {
          // F5-011: all scenes must be 'done' before we can assemble.
          const notReady = scenes.filter((s) => s.status !== 'done' || !s.video_url)
          if (notReady.length > 0) {
            // Audit 16/06/26 W1 — surface the real cause when credits are
            // the blocker, instead of the generic "scenes not ready".
            // If NO scene has been generated AND the user can't afford even
            // one, we know it's a credit wall, not user inaction.
            const anyDone = scenes.some((s) => s.status === 'done')
            if (!anyDone && !canAfford) {
              toast.error(t('st_scenesNotReadyNoCredits'))
              return
            }
            toast.error(t('st_scenesNotReady').replace('{n}', String(notReady.length)))
            return
          }
          try {
            const result = await renderStudioFinal(project.id, project.format as '16_9' | '9_16')
            toast.success(t('st_renderStarted').replace('{n}', String(result.sceneCount)))
            setProject((p) => (p ? { ...p, status: 'rendering' } : p))
          } catch (err) {
            if (err instanceof ApiError && err.code === 'INSUFFICIENT_CREDITS') {
              toast.error(t('st_insufficientCredits'))
            } else {
              toast.error(t('st_renderFailed'))
            }
          }
        }}
        onPreview={() => router.push(`/studio/${project.id}/preview`)}
      />

      {/* Call-to-action strip if scenes haven't been generated yet */}
      {scenes.every((s) => s.status === 'pending') && (
        <div className="shrink-0 px-4 py-2.5 bg-brand/10 border-b border-brand/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <p className="font-body text-sm text-foreground">
              <span className="font-semibold">{t('st_scenesReadyCount').replace('{n}', String(scenes.length))}</span>{' '}
              <span className="text-[--text-secondary]">{t('st_clickGenerate')}</span>
            </p>
            {!creditsLoading && !isUnlimited && (
              <span className={`inline-flex items-center gap-1.5 font-mono text-xs shrink-0 ${canAfford ? 'text-[--text-secondary]' : 'text-error font-semibold'}`}>
                <Coins size={12} />
                {t('st_costEstimate').replace('{cost}', String(estimatedCost)).replace('{balance}', String(credits))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={startGeneration}
            disabled={starting || !canAfford}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-1.5 font-display text-sm font-semibold hover:bg-brand-hover disabled:opacity-60 transition-colors shrink-0"
          >
            {starting ? <Loader2 size={13} className="animate-spin" /> : '⚡'}
            {t('st_generateAll')}
          </button>
        </div>
      )}

      {/* Main area: preview + inspector */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <PreviewPlayer
          scene={selectedScene}
          format={project.format}
          onRetry={(id) => handleRegenerate({ sceneId: id })}
        />
        <SceneInspector
          scene={selectedScene}
          onRegenerate={handleRegenerate}
          onDelete={handleDeleteScene}
          // Audit 16/06/26 W1 — sync preview badge + timeline thumbnail to
          // the inspector type picker without waiting for Regenerate. The
          // user can still click Regenerate to actually re-render the video.
          onTypeChange={(sceneId, type) => setScenes((prev) =>
            prev.map((s) => (s.id === sceneId ? { ...s, type } : s)),
          )}
        />
      </div>

      {/* Timeline bar */}
      <TimelineEditor
        scenes={scenes}
        selectedSceneId={selectedId}
        onSelectScene={setSelectedId}
        onRegenerateScene={(id) => handleRegenerate({ sceneId: id })}
        onAddScene={handleAddScene}
        projectDuration={totalDuration}
        musicTrackName={project.music_track ?? undefined}
      />

      <ConfirmDialog
        isOpen={sceneToDelete !== null}
        onClose={() => setSceneToDelete(null)}
        onConfirm={async () => {
          if (sceneToDelete) await confirmDeleteScene(sceneToDelete)
        }}
        title={t('si_deleteScene')}
        message={t('st_deleteSceneConfirm')}
      />
    </div>
  )
}
