'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShowcaseVideo {
  title:          string
  thumbnail:      string
  videoUrl:       string
  style:          string
  styleBadge:     React.ComponentProps<typeof Badge>['variant']
  feature:        string
  duration:       string
  generationTime: string
  /** CSS gradient for placeholder when no thumbnail image exists yet */
  placeholderGradient: string
}

// ── Data — replace thumbnail/videoUrl with real assets when ready ──────────────
// NOTE : use /demo/showcase/<slug>-thumb.jpg and /demo/showcase/<slug>.mp4
// Generated with CLYRO locally. Never use grey placeholders.

const SHOWCASE_VIDEOS: ShowcaseVideo[] = [
  {
    title:               'The 5 habits of millionaires',
    thumbnail:           '/demo/showcase/millionaires-thumb.jpg',
    videoUrl:            '/demo/showcase/millionaires.mp4',
    style:               '2D Animation',
    styleBadge:          'info',
    feature:             'Faceless Video',
    duration:            '2:14',
    generationTime:      'Generated in 4 min',
    placeholderGradient: 'from-orange-500/40 via-amber-500/20 to-yellow-500/10',
  },
  {
    title:               'Nova Headset — product launch',
    thumbnail:           '/demo/showcase/casque-thumb.jpg',
    videoUrl:            '/demo/showcase/casque.mp4',
    style:               'Motion Design',
    styleBadge:          'purple',
    feature:             'Motion Design',
    duration:            '0:32',
    generationTime:      'Generated in 2 min',
    placeholderGradient: 'from-violet-500/40 via-purple-500/20 to-indigo-500/10',
  },
  {
    title:               'How Bitcoin works',
    thumbnail:           '/demo/showcase/bitcoin-thumb.jpg',
    videoUrl:            '/demo/showcase/bitcoin.mp4',
    style:               'Infographics',
    styleBadge:          'info',
    feature:             'Faceless Video',
    duration:            '3:45',
    generationTime:      'Generated in 6 min',
    placeholderGradient: 'from-blue-500/40 via-cyan-500/20 to-teal-500/10',
  },
  {
    title:               'Startup pitch — Avatar Studio',
    thumbnail:           '/demo/showcase/avatar-pitch-thumb.jpg',
    videoUrl:            '/demo/showcase/avatar-pitch.mp4',
    style:               'AI Avatar',
    styleBadge:          'success',
    feature:             'Avatar Studio',
    duration:            '1:20',
    generationTime:      'Generated in 3 min',
    placeholderGradient: 'from-emerald-500/40 via-green-500/20 to-teal-500/10',
  },
  {
    title:               'Volta Energy — brand identity',
    thumbnail:           '/demo/showcase/volta-thumb.jpg',
    videoUrl:            '/demo/showcase/volta.mp4',
    style:               'Brand Kit',
    styleBadge:          'neutral',
    feature:             'Brand Kit',
    duration:            '0:45',
    generationTime:      'Generated in 8 min',
    placeholderGradient: 'from-slate-500/40 via-zinc-500/20 to-gray-500/10',
  },
  {
    title:               'The secret of deep sleep',
    thumbnail:           '/demo/showcase/sleep-thumb.jpg',
    videoUrl:            '/demo/showcase/sleep.mp4',
    style:               'Cinematic',
    styleBadge:          'purple',
    feature:             'Faceless Video',
    duration:            '4:12',
    generationTime:      'Generated in 7 min',
    placeholderGradient: 'from-indigo-900/60 via-violet-900/40 to-purple-900/20',
  },
]

// ── ShowcaseCard ───────────────────────────────────────────────────────────────

function ShowcaseCard({ video, onPlay }: { video: ShowcaseVideo; onPlay: () => void }) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        'flex-shrink-0 snap-start w-64 sm:w-72',
        'rounded-2xl overflow-hidden border border-border/50',
        'bg-card hover:border-border',
        'transition-all duration-200 group text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
      aria-label={`Watch ${video.title}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {/* Placeholder gradient (shown when image hasn't loaded yet or on error) */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br',
            video.placeholderGradient,
            'flex items-center justify-center',
          )}
        >
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <Play size={16} className="text-white/60 ml-0.5" />
          </div>
        </div>

        {/* Real thumbnail image */}
        {!imgError && (
          <img
            src={video.thumbnail}
            alt={video.title}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-200">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200 shadow-lg">
            <Play size={16} className="text-gray-900 ml-0.5" />
          </div>
        </div>

        {/* Style badge — top left */}
        <Badge variant={video.styleBadge} className="absolute top-2 left-2 text-xs backdrop-blur-sm">
          {video.style}
        </Badge>

        {/* Duration — bottom right */}
        <span className="absolute bottom-2 right-2 font-mono text-xs text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-display text-sm text-foreground truncate">{video.title}</p>
        <p className="font-mono text-xs text-[--text-muted] mt-0.5">
          {video.feature} · {video.generationTime}
        </p>
      </div>
    </button>
  )
}

// ── VideoModal ─────────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: ShowcaseVideo; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${video.title}`}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full rounded-2xl overflow-hidden shadow-2xl border border-border/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video player */}
        <video
          src={video.videoUrl}
          controls
          autoPlay
          playsInline
          className="w-full aspect-video bg-black"
          onError={(e) => {
            // If video can't load, show poster gradient instead
            const el = e.currentTarget
            el.style.display = 'none'
          }}
        />

        {/* Info bar */}
        <div className="bg-card px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-base text-foreground truncate">{video.title}</p>
            <p className="font-mono text-xs text-[--text-muted] mt-0.5">
              {video.feature} · {video.style} · {video.generationTime}
            </p>
          </div>
          <Link href="/signup" className="shrink-0">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
              Create the same
            </Button>
          </Link>
        </div>

        {/* Close button */}
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full p-2 hover:bg-black/80 transition-colors text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ── VideoShowcase (public export) ──────────────────────────────────────────────

export function VideoShowcase() {
  const carouselRef                     = useRef<HTMLDivElement>(null)
  const [playingVideo, setPlayingVideo] = useState<ShowcaseVideo | null>(null)

  function scrollCarousel(dir: -1 | 1) {
    carouselRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }

  return (
    <section
      className="relative bg-card border-y border-border/50 py-12 overflow-hidden"
      aria-label="Made with CLYRO — video showcase"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 rounded-xl p-2 shrink-0">
              <Play className="text-blue-400" size={16} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Made with CLYRO</h2>
              <p className="font-mono text-xs text-[--text-muted] mt-0.5">
                Videos generated with the exact same tools you&apos;re about to use
              </p>
            </div>
          </div>

          {/* Nav arrows — desktop only */}
          <div className="hidden md:flex gap-2">
            <button
              type="button"
              onClick={() => scrollCarousel(-1)}
              aria-label="Previous videos"
              className="p-2 rounded-lg bg-muted border border-border hover:bg-background transition-colors"
            >
              <ChevronLeft size={16} className="text-[--text-secondary]" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(1)}
              aria-label="Next videos"
              className="p-2 rounded-lg bg-muted border border-border hover:bg-background transition-colors"
            >
              <ChevronRight size={16} className="text-[--text-secondary]" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {SHOWCASE_VIDEOS.map((video, i) => (
            <ShowcaseCard key={i} video={video} onPlay={() => setPlayingVideo(video)} />
          ))}
        </div>
      </div>

      {/* Video modal */}
      {playingVideo && (
        <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </section>
  )
}
