'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { StudioTopBar } from '@/components/studio/StudioTopBar'
import { PreviewPlayer } from '@/components/studio/PreviewPlayer'
import { SceneInspector } from '@/components/studio/SceneInspector'
import { TimelineEditor } from '@/components/studio/TimelineEditor'
import { toast } from '@/components/ui/toast'
import { createBrowserClient } from '@/lib/supabase'
import {
  getStudioProject, generateAllStudioScenes, regenerateStudioScene,
  addStudioScene, deleteStudioScene, renderStudioFinal,
} from '@/lib/api'
import type {
  StudioProject, StudioScene, StudioSceneType,
} from '@/lib/studio-types'

export const dynamic = 'force-dynamic'

export default function StudioEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = String(params?.id ?? '')

  const [project, setProject]   = useState<StudioProject | null>(null)
  const [scenes, setScenes]     = useState<StudioScene[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

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
        toast.error(err instanceof Error ? err.message : 'Failed to load project')
        router.push('/dashboard')
      })
      .finally(() => setLoading(false))
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
          if (updated.status === 'done') toast.success(`Scene ${updated.index + 1} ready`)
          if (updated.status === 'error') toast.error(`Scene ${updated.index + 1} failed`)
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
  }, [projectId])

  // ── Actions ───────────────────────────────────────────────────────────

  const selectedScene = scenes.find((s) => s.id === selectedId) ?? null
  const scenesDone = scenes.filter((s) => s.status === 'done').length
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration_actual ?? s.duration_est ?? 0), 0)

  const startGeneration = useCallback(async () => {
    if (!project || starting) return
    setStarting(true)
    try {
      await generateAllStudioScenes(project.id)
      toast.success('Generation started — scenes will appear as they finish')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start generation')
    } finally {
      setStarting(false)
    }
  }, [project, starting])

  const handleRegenerate = useCallback(async (payload: {
    sceneId: string; script?: string; feedback?: string; type?: StudioSceneType
  }) => {
    if (!project) return
    try {
      await regenerateStudioScene({
        projectId: project.id,
        sceneId:   payload.sceneId,
        newScript: payload.script,
        feedback:  payload.feedback,
        newType:   payload.type,
      })
      toast.success('Regeneration queued')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Regeneration failed')
    }
  }, [project])

  const handleAddScene = useCallback(async (afterIndex: number) => {
    if (!project) return
    try {
      await addStudioScene({ projectId: project.id, afterIndex })
      // Refetch scenes
      const fresh = await getStudioProject(project.id)
      setScenes(fresh.scenes as StudioScene[])
      toast.success('Scene added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add scene')
    }
  }, [project])

  const handleDeleteScene = useCallback(async (sceneId: string) => {
    if (!confirm('Delete this scene?')) return
    try {
      await deleteStudioScene(sceneId)
      setScenes((prev) => prev.filter((s) => s.id !== sceneId))
      if (selectedId === sceneId) setSelectedId(null)
      toast.success('Scene deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete scene')
    }
  }, [selectedId])

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
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
            toast.error(
              `${notReady.length} scène(s) ne sont pas prêtes. Génère ou régénère-les avant d'exporter.`,
            )
            return
          }
          try {
            const result = await renderStudioFinal(project.id, project.format as '16_9' | '9_16')
            toast.success(
              `Rendu lancé sur ${result.sceneCount} scènes. Tu seras notifié dès que la vidéo finale est prête.`,
            )
            setProject((p) => (p ? { ...p, status: 'rendering' } : p))
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Échec du rendu'
            toast.error(msg)
          }
        }}
        onPreview={() => router.push(`/studio/${project.id}/preview`)}
      />

      {/* Call-to-action strip if scenes haven't been generated yet */}
      {scenes.every((s) => s.status === 'pending') && (
        <div className="shrink-0 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/30 flex items-center justify-between gap-4">
          <p className="font-body text-sm text-foreground">
            <span className="font-semibold">{scenes.length} scenes ready.</span>{' '}
            <span className="text-[--text-secondary]">Click Generate to produce each video.</span>
          </p>
          <button
            type="button"
            onClick={startGeneration}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-500 text-white px-4 py-1.5 font-display text-sm font-semibold hover:bg-blue-600 disabled:opacity-60 transition-colors"
          >
            {starting ? <Loader2 size={13} className="animate-spin" /> : '⚡'}
            Generate all
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
    </div>
  )
}
