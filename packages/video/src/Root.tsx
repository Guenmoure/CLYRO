import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { BrandOverlay, BrandOverlayProps } from './compositions/BrandOverlay'
import { DynamicComposition } from './compositions/DynamicComposition'
import type { ComponentType } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BrandOverlayAny = BrandOverlay as ComponentType<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DynamicCompositionAny = DynamicComposition as ComponentType<any>

const DEFAULT_FPS = 30

// Default props used only for the Remotion Studio preview / type inference.
// Actual values are injected at render time via inputProps.
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

    {/* DynamicComposition — 16:9 */}
    <Composition
      id="DynamicMotion-16-9"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1920}
      height={1080}
      defaultProps={{ ...defaultProps, format: '16:9' }}
    />
    {/* DynamicComposition — 9:16 */}
    <Composition
      id="DynamicMotion-9-16"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...defaultProps, format: '9:16' }}
    />
    {/* DynamicComposition — 1:1 */}
    <Composition
      id="DynamicMotion-1-1"
      component={DynamicCompositionAny}
      durationInFrames={DEFAULT_FPS * 30}
      fps={DEFAULT_FPS}
      width={1080}
      height={1080}
      defaultProps={{ ...defaultProps, format: '1:1' }}
    />
  </>
)

registerRoot(RemotionRoot)
