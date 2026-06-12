'use client'

import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import type { StudioAvatar } from '@/lib/api'
import type { AvatarGroup } from '@/lib/avatar-grouping'

/** Flattened look entry for the unified grid. */
interface FlatLook {
  id: string
  name: string
  preview_image_url: string
  preview_video_url?: string
  avatar: StudioAvatar
}

interface AvatarPreviewModalProps {
  group: AvatarGroup | null
  isOpen: boolean
  onClose: () => void
  onUse?: (avatar: StudioAvatar, lookId?: string) => void
}

export function AvatarPreviewModal({ group, isOpen, onClose, onUse }: AvatarPreviewModalProps) {
  const { t } = useLanguage()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Flatten all looks from all avatars in the group into one list
  const allLooks = useMemo<FlatLook[]>(() => {
    if (!group) return []
    const looks: FlatLook[] = []
    for (const av of group.avatars) {
      if (av.looks.length > 0) {
        for (const look of av.looks) {
          looks.push({
            id: look.look_id,
            name: look.name || av.avatar_name,
            preview_image_url: look.preview_image_url,
            preview_video_url: look.preview_video_url,
            avatar: av,
          })
        }
      } else {
        // Avatar with no looks array — treat itself as a single look
        looks.push({
          id: av.avatar_id,
          name: av.avatar_name,
          preview_image_url: av.preview_image_url,
          preview_video_url: av.preview_video_url,
          avatar: av,
        })
      }
    }
    return looks
  }, [group])

  if (!group) return null

  const activeLook = allLooks.find((l) => l.id === selectedId) ?? allLooks[0]
  const previewUrl = activeLook?.preview_video_url
  const imageUrl = activeLook?.preview_image_url

  const CATEGORY_LABELS: Record<string, string> = {
    professional: t('apm_category_professional'),
    lifestyle: t('apm_category_lifestyle'),
    ugc: t('apm_category_ugc'),
    community: t('apm_category_community'),
    other: t('apm_category_other'),
  }

  const firstAvatar = group.avatars[0]!

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setSelectedId(null) }}
      size="xl"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col md:flex-row min-h-[480px]">

        {/* Left — visual preview */}
        <div className="md:w-[44%] aspect-[3/4] md:aspect-auto bg-background flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-none md:rounded-l-2xl">
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              className="w-full h-full object-cover"
              autoPlay loop muted playsInline
            />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={group.baseName} decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand/15 to-violet-500/15 flex items-center justify-center">
              <span className="font-display text-6xl text-foreground/20">
                {group.baseName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Right — info + looks + actions */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto">
          {/* Header */}
          <div>
            <h2 className="font-display text-2xl text-foreground">{group.baseName}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="neutral">
                {CATEGORY_LABELS[firstAvatar.category] ?? firstAvatar.category}
              </Badge>
              {firstAvatar.gender && (
                <Badge variant="info">{firstAvatar.gender}</Badge>
              )}
              {firstAvatar.premium && (
                <Badge variant="warning">Pro</Badge>
              )}
            </div>
          </div>

          {/* Tags */}
          {firstAvatar.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {firstAvatar.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-xs text-[--text-muted] bg-muted rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* All looks grid */}
          {allLooks.length > 1 && (
            <div className="mt-6">
              <p className="font-mono text-xs text-[--text-muted] uppercase tracking-widest mb-3">
                {allLooks.length} {t('apm_looks_available')}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {allLooks.map((look) => {
                  const isActive = activeLook?.id === look.id
                  return (
                    <button
                      key={look.id}
                      type="button"
                      onClick={() => setSelectedId(look.id)}
                      className={cn(
                        'relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-150',
                        isActive ? 'border-primary ring-2 ring-brand/20' : 'border-border hover:border-brand/40',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={look.preview_image_url}
                        alt={look.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                        <p className="font-mono text-[10px] text-white/90 truncate text-center">{look.name}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="mt-6 space-y-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                if (activeLook) {
                  onUse?.(activeLook.avatar, activeLook.id !== activeLook.avatar.avatar_id ? activeLook.id : undefined)
                }
                onClose()
                setSelectedId(null)
              }}
            >
              {t('apm_use_in_project')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
