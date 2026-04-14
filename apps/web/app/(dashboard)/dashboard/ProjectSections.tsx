'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Plus, Video, Sparkles, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard, type VideoProject } from '@/components/dashboard/ProjectCard'
import { NewProjectCard } from '@/components/dashboard/NewProjectCard'
import { RealtimeProjects } from '@/components/dashboard/RealtimeProjects'
import { cn } from '@/lib/utils'

// ── Module config (client-side only — icons are functions, not serialisable) ───

interface ModuleConfig {
  key:       'faceless' | 'motion' | 'brand'
  label:     string
  icon:      React.ElementType
  iconColor: string
  iconBg:    string
  href:      string
  newHref:   string
}

const MODULES: readonly ModuleConfig[] = [
  {
    key:       'faceless',
    label:     'Faceless Videos',
    icon:      Video,
    iconColor: 'text-blue-400',
    iconBg:    'bg-blue-500/10',
    href:      '/faceless',
    newHref:   '/faceless/new',
  },
  {
    key:       'motion',
    label:     'Motion Design',
    icon:      Sparkles,
    iconColor: 'text-purple-400',
    iconBg:    'bg-purple-500/10',
    href:      '/motion',
    newHref:   '/motion/new',
  },
  {
    key:       'brand',
    label:     'Brand Kit',
    icon:      Palette,
    iconColor: 'text-cyan-400',
    iconBg:    'bg-cyan-400/10',
    href:      '/brand',
    newHref:   '/brand',
  },
] as const

interface ProjectSectionsProps {
  userId: string
  videos: VideoProject[]
}

// ── Section ────────────────────────────────────────────────────────────────────

function ModuleSection({
  config,
  projects,
  total,
}: {
  config: ModuleConfig
  projects: VideoProject[]
  total: number
}) {
  const Icon = config.icon

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-xl p-2 shrink-0', config.iconBg)}>
            <Icon size={18} className={config.iconColor} />
          </div>
          <div>
            <h2 className="font-display text-lg text-foreground leading-none">{config.label}</h2>
            <p className="font-mono text-xs text-[--text-muted] mt-0.5">
              {total} projet{total !== 1 ? 's' : ''} au total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 4 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={config.href}>Voir tout →</Link>
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={13} />}
            asChild
          >
            <Link href={config.newHref}>Créer</Link>
          </Button>
        </div>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState config={config} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {projects.slice(0, 4).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          <NewProjectCard feature={config.key} />
        </div>
      )}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ config }: { config: ModuleConfig }) {
  const Icon = config.icon
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border bg-card/50">
      <div className={cn('rounded-2xl p-6 mb-4', config.iconBg)}>
        <Icon size={32} className={config.iconColor} />
      </div>
      <p className="font-display text-base text-foreground">
        Aucun projet {config.label} pour l'instant
      </p>
      <p className="font-body text-sm text-[--text-muted] mt-2 max-w-xs">
        Crée ton premier projet en moins de 5 minutes.
      </p>
      <Button variant="primary" size="md" leftIcon={<Plus size={15} />} className="mt-4" asChild>
        <Link href={config.newHref}>Créer mon premier projet</Link>
      </Button>
    </div>
  )
}

// ── ProjectSections ────────────────────────────────────────────────────────────

export function ProjectSections({ userId, videos }: ProjectSectionsProps) {
  const [projects, setProjects] = useState<VideoProject[]>(videos)

  const handleUpdate = useCallback((id: string, patch: Partial<VideoProject>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  return (
    <>
      <RealtimeProjects userId={userId} onUpdate={handleUpdate} />

      {MODULES.map((mod) => {
        const modProjects = projects.filter(p => p.module === mod.key)
        return (
          <ModuleSection
            key={mod.key}
            config={mod}
            projects={modProjects}
            total={modProjects.length}
          />
        )
      })}
    </>
  )
}
