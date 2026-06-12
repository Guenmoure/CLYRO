'use client'

import { useState, useRef } from 'react'
import { Video, Upload, Sparkles, Check } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

type CreateTab = 'instant' | 'photo'

interface CreateAvatarModalProps {
  isOpen:  boolean
  onClose: () => void
}

const INSTANT_REQUIREMENT_KEYS = [
  'cam_req_duration',
  'cam_req_face',
  'cam_req_lighting',
  'cam_req_format',
  'cam_req_size',
] as const

export function CreateAvatarModal({ isOpen, onClose }: CreateAvatarModalProps) {
  const { t } = useLanguage()
  const [activeTab,     setActiveTab]     = useState<CreateTab>('instant')
  const [videoFile,     setVideoFile]     = useState<File | null>(null)
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [dragOver,      setDragOver]      = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setVideoFile(f)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setPhotoFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (activeTab === 'instant') setVideoFile(f)
    else setPhotoFile(f)
  }

  const uploadedFile = activeTab === 'instant' ? videoFile : photoFile

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cam_title')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cam_cancel')}</Button>
          <Button variant="primary" disabled={!uploadedFile} leftIcon={<Sparkles size={14} />}>
            {t('cam_title')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {([
            { key: 'instant', label: t('cam_tab_instant'), icon: Video   },
            { key: 'photo',   label: t('cam_tab_photo'),   icon: Upload  },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-body text-sm transition-all duration-150',
                activeTab === key
                  ? 'bg-card text-foreground shadow-card border border-border/50'
                  : 'text-[--text-muted] hover:text-foreground',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'instant' ? (
          <div className="space-y-5">
            {/* Upload zone */}
            <div
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200',
                dragOver
                  ? 'border-brand/60 bg-brand/5'
                  : videoFile
                    ? 'border-success/40 bg-success/5'
                    : 'border-border hover:border-brand/40 hover:bg-brand/5',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,.mov"
                className="sr-only"
                onChange={handleVideoChange}
              />

              {videoFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-success/15 flex items-center justify-center">
                    <Check size={22} className="text-success" />
                  </div>
                  <p className="font-display text-sm text-foreground">{videoFile.name}</p>
                  <p className="font-mono text-xs text-[--text-muted]">
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {t('cam_change_video')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Video size={28} className="text-[--text-muted]" />
                  </div>
                  <div>
                    <p className="font-display text-base text-foreground">
                      {t('cam_instant_headline')}
                    </p>
                    <p className="font-body text-sm text-[--text-secondary] mt-1">
                      {t('cam_instant_hint')}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {t('cam_choose_video')}
                  </Button>
                  <p className="font-mono text-xs text-[--text-muted]">
                    {t('cam_drag_drop')}
                  </p>
                </div>
              )}
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              {INSTANT_REQUIREMENT_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Check size={12} className="text-success shrink-0" />
                  <p className="font-body text-sm text-[--text-secondary]">{t(key)}</p>
                </div>
              ))}
            </div>

            {/* Plan notice */}
            <div className="flex justify-center">
              <Badge variant="purple" dot>{t('cam_plan_notice')}</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Photo upload */}
            <div
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
                dragOver
                  ? 'border-brand/60 bg-brand/5'
                  : photoFile
                    ? 'border-success/40 bg-success/5'
                    : 'border-border hover:border-brand/40 hover:bg-brand/5',
              )}
              onClick={() => photoInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoChange}
              />

              {photoFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-success/15 flex items-center justify-center">
                    <Check size={22} className="text-success" />
                  </div>
                  <p className="font-display text-sm text-foreground">{photoFile.name}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Upload size={28} className="text-[--text-muted]" />
                  </div>
                  <div>
                    <p className="font-display text-base text-foreground">
                      {t('cam_photo_headline')}
                    </p>
                    <p className="font-body text-sm text-[--text-secondary] mt-1">
                      {t('cam_photo_hint')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-muted border border-border px-4 py-3">
              <p className="font-body text-xs text-[--text-secondary]">
                {t('cam_photo_quality_notice')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
