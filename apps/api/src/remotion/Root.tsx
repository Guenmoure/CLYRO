import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { BrandOverlay, BrandOverlayProps, KenBurnsClip, DynamicComposition, MotionComposition } from '@clyro/video'
import type { MotionCompositionProps } from '@clyro/video'
import type { ComponentType } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BrandOverlayAny       = BrandOverlay       as ComponentType<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const KenBurnsClipAny       = KenBurnsClip       as ComponentType<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DynamicCompositionAny = DynamicComposition as ComponentType<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionCompositionAny  = MotionComposition  as ComponentType<any>

const DEFAULT_FPS = 30

// Default props — Remotion Studio preview only; actual values come from inputProps at render time.
const defaultMotionProps: MotionCompositionProps = {
  scenes: [],
  format: '16_9',
}

const defaultProps: BrandOverlayProps = {
  scenes: [
    {
      id: 'scene-1',
      description_visuelle: 'Opening scene',
      texte_voix: 'Bienvenue chez CLYRO',
      duree_estimee: 3,
      image_url: undefined,
    },
  ],
  brandConfig: {
    primary_color: '#3B8EF0',
    secondary_color: '#A855F7',
    font_family: 'Arial, sans-serif',
  },
  format: '16:9',
  audioSrc: undefined,
}

const RemotionRoot: React.FC = () => (
  <>
    {/* 16:9 — landscape */}
    <Composition
      id="BrandOverlay-16-9"
      component={BrandOverlayAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1920}
      height={1080}
      defaultProps={{ ...defaultProps, format: '16:9' }}
    />
    {/* 9:16 — vertical (Stories/Reels) */}
    <Composition
      id="BrandOverlay-9-16"
      component={BrandOverlayAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...defaultProps, format: '9:16' }}
    />
    {/* 1:1 — square */}
    <Composition
      id="BrandOverlay-1-1"
      component={BrandOverlayAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1080}
      defaultProps={{ ...defaultProps, format: '1:1' }}
    />

    {/* Ken Burns — $0 GPU clip for illustration/whiteboard styles */}
    <Composition
      id="KenBurnsClip"
      component={KenBurnsClipAny}
      durationInFrames={DEFAULT_FPS * 10}
      fps={DEFAULT_FPS}
      width={1920}
      height={1080}
      defaultProps={{ imageUrl: 'https://via.placeholder.com/1920x1080' }}
    />

    {/* DynamicMotion — scene_type-aware composition for Motion Design */}
    <Composition
      id="DynamicMotion-16-9"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1920}
      height={1080}
      defaultProps={{ ...defaultProps, format: '16:9' }}
    />
    <Composition
      id="DynamicMotion-9-16"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...defaultProps, format: '9:16' }}
    />
    <Composition
      id="DynamicMotion-1-1"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1080}
      defaultProps={{ ...defaultProps, format: '1:1' }}
    />

    {/* MotionDesign — F2 high-quality agency-level compositions */}
    <Composition
      id="MotionDesign-16-9"
      component={MotionCompositionAny}
      durationInFrames={DEFAULT_FPS * 45}
      fps={DEFAULT_FPS}
      width={1920}
      height={1080}
      defaultProps={{ ...defaultMotionProps, format: '16_9' }}
    />
    <Composition
      id="MotionDesign-9-16"
      component={MotionCompositionAny}
      durationInFrames={DEFAULT_FPS * 45}
      fps={DEFAULT_FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...defaultMotionProps, format: '9_16' }}
    />
    <Composition
      id="MotionDesign-1-1"
      component={MotionCompositionAny}
      durationInFrames={DEFAULT_FPS * 45}
      fps={DEFAULT_FPS}
      width={1080}
      height={1080}
      defaultProps={{ ...defaultMotionProps, format: '1_1' }}
    />
  </>
)

registerRoot(RemotionRoot)
