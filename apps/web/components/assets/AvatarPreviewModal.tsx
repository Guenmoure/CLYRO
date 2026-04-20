'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StudioAvatar } from '@/lib/api'

interface AvatarPreviewModalProps {
  avatar:   StudioAvatar | null
  isOpen:   boolean
  onClose:  () => void
  onUse?:   (avatar: StudioAvatar) => void
}

export function AvatarPreviewModal({ avatar, isOpen, onClose, onUse }: AvatarPreviewModalProps) {
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)

  if (!avatar) return null

  const activeLook = selectedLookId
    ? avatar.looks.find((l) => l.look_id === selectedLookId) ?? avatar.looks[0]
    : avatar.looks[0]

  const previewUrl = activeLook?.preview_video_url ?? avatar.preview_video_url
  const imageUrl   = activeLook?.preview_image_url ?? avatar.preview_image_url

  const CATEGORY_LABELS: Record<string, string> = {
    professional: 'Professionnel',
    lifestyle:    'Lifestyle',
    ugc:          'UGC',
    community:    'Communauté',
    other:        'Autre',
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col md:flex-row min-h-[480px]">

        {/* Left — visual preview */}
        <div className="md:w-[44%] aspect-[3/4] md:aspect-auto bg-navy-950 flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-none md:rounded-l-2xl">
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              className="w-full h-full object-cover"
              autoPlay loop muted playsInline
            />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={avatar.avatar_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="font-display text-6xl text-foreground/20">
                {avatar.avatar_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Right — info + looks + actions */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto">
          {/* Header */}
          <div>
            <h2 className="font-display text-2xl text-foreground">{avatar.avatar_name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="neutral">
                {CATEGORY_LABELS[avatar.category] ?? avatar.category}
              </Badge>
              {avatar.gender && (
                <Badge variant="info">{avatar.gender}</Badge>
              )}
              {avatar.premium && (
                <Badge variant="warning">Pro</Badge>
              )}
            </div>
          </div>

          {/* Tags */}
          {avatar.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {avatar.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-xs text-[--text-muted] bg-muted rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Looks grid */}
          {avatar.looks.length > 1 && (
            <div className="mt-6">
              <p className="font-mono text-xs text-[--text-muted] uppercase tracking-widest mb-3">
                {avatar.looks.length} looks disponibles
              </p>
              <div className="grid grid-cols-3 gap-2">
                {avatar.looks.map((look) => {
                  const isActive = selectedLookId === look.look_id || (!selectedLookId && look === avatar.looks[0])
                  return (
                    <button
                      key={look.look_id}
                      type="button"
                      onClick={() => setSelectedLookId(look.look_id)}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                        isActive ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border hover:border-border',
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
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                        <p className="font-mono text-[9px] text-white/80 truncate text-center">{look.name}</p>
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
              onClick={() => { onUse?.(avatar); onClose() }}
            >
              Utiliser dans un projet
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
