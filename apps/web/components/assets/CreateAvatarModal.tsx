'use client'

import { useState, useRef } from 'react'
import { Video, Upload, Sparkles, Check } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type CreateTab = 'instant' | 'photo'

interface CreateAvatarModalProps {
  isOpen:  boolean
  onClose: () => void
}

const INSTANT_REQUIREMENTS = [
  'Durée min 2 min',
  'Face visible, regard caméra',
  'Fond neutre, bonne lumière',
  'Format MP4 ou MOV',
  'Max 200 MB',
]

export function CreateAvatarModal({ isOpen, onClose }: CreateAvatarModalProps) {
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
      title="Créer mon avatar"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!uploadedFile} leftIcon={<Sparkles size={14} />}>
            Créer mon avatar
          </Button>
        </>
      }
    >
      <div className="space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {([
            { key: 'instant', label: 'Instant Avatar', icon: Video   },
            { key: 'photo',   label: 'Photo Avatar',   icon: Upload  },
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
                  ? 'border-blue-500/60 bg-blue-500/5'
                  : videoFile
                    ? 'border-success/40 bg-success/5'
                    : 'border-border hover:border-blue-500/40 hover:bg-blue-500/5',
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
                    Changer la vidéo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Video size={28} className="text-[--text-muted]" />
                  </div>
                  <div>
                    <p className="font-display text-base text-foreground">
                      Enregistre 2 minutes de toi en train de parler
                    </p>
                    <p className="font-body text-sm text-[--text-secondary] mt-1">
                      Face à la caméra · Fond neutre · Bonne lumière
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    Choisir une vidéo
                  </Button>
                  <p className="font-mono text-xs text-[--text-muted]">
                    ou glisse et dépose ici
                  </p>
                </div>
              )}
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              {INSTANT_REQUIREMENTS.map((req) => (
                <div key={req} className="flex items-center gap-2">
                  <Check size={12} className="text-success shrink-0" />
                  <p className="font-body text-sm text-[--text-secondary]">{req}</p>
                </div>
              ))}
            </div>

            {/* Plan notice */}
            <div className="flex justify-center">
              <Badge variant="purple" dot>Creator &amp; Studio uniquement</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Photo upload */}
            <div
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
                dragOver
                  ? 'border-blue-500/60 bg-blue-500/5'
                  : photoFile
                    ? 'border-success/40 bg-success/5'
                    : 'border-border hover:border-blue-500/40 hover:bg-blue-500/5',
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
                      Génère un avatar depuis une photo de profil
                    </p>
                    <p className="font-body text-sm text-[--text-secondary] mt-1">
                      Portrait haute résolution recommandé
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-muted border border-border px-4 py-3">
              <p className="font-body text-xs text-[--text-secondary]">
                ⚠️ Les résultats photo sont moins naturels qu'un Instant Avatar.
                Pour une meilleure qualité, enregistre une vidéo de 2 minutes.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
