import React, { useMemo } from 'react'
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  Audio,
} from 'remotion'
import type { BrandOverlayProps, BrandScene, BrandConfig, SceneType } from './BrandOverlay'
import { TextHero }        from './scenes/TextHero'
import { SplitTextImage }  from './scenes/SplitTextImage'
import { ProductShowcase } from './scenes/ProductShowcase'
import { StatsCounter }    from './scenes/StatsCounter'
import { CtaEnd }          from './scenes/CtaEnd'
import { ImageFull }       from './scenes/ImageFull'

// ── Scene router ───────────────────────────────────────────────────────────────

interface SceneComponentProps {
  scene: BrandScene
  brandConfig: BrandConfig
  frameOffset?: number
}

const SCENE_COMPONENTS: Record<SceneType, React.FC<SceneComponentProps>> = {
  text_hero:        TextHero,
  split_text_image: SplitTextImage,
  product_showcase: ProductShowcase,
  stats_counter:    StatsCounter,
  cta_end:          CtaEnd,
  image_full:       ImageFull,
}

function SceneRouter({ scene, brandConfig, frameOffset }: SceneComponentProps) {
  const Component = scene.scene_type
    ? (SCENE_COMPONENTS[scene.scene_type] ?? ImageFull)
    : ImageFull
  return <Component scene={scene} brandConfig={brandConfig} frameOffset={frameOffset} />
}

// ── Cross-fade constant ─────────────────────────────────────────────────────────

const CROSSFADE_FRAMES = 10

// ── DynamicComposition ─────────────────────────────────────────────────────────

export const DynamicComposition: React.FC<BrandOverlayProps> = ({
  scenes,
  brandConfig,
  audioSrc,
  musicSrc,
}) => {
  const { fps } = useVideoConfig()

  const frameOffsets = useMemo(() => {
    const offsets: number[] = []
    let current = 0
    for (const scene of scenes) {
      offsets.push(current)
      current += Math.max(1, Math.round(scene.duree_estimee * fps))
    }
    return offsets
  }, [scenes, fps])

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {audioSrc && <Audio src={audioSrc} />}
      {musicSrc && <Audio src={musicSrc} volume={0.12} />}

      {scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={Math.max(0, frameOffsets[i] - (i > 0 ? CROSSFADE_FRAMES : 0))}
          durationInFrames={
            Math.max(1, Math.round(scene.duree_estimee * fps)) +
            (i > 0 ? CROSSFADE_FRAMES : 0)
          }
        >
          <SceneRouter
            scene={scene}
            brandConfig={brandConfig}
            frameOffset={i}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
