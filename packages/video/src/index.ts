// Public API for @clyro/video
// ─────────────────────────────────────────────────────────────────────────────
// Import this package in:
//   • apps/web  → for live preview with @remotion/player
//   • apps/api  → for server-side rendering via Remotion Lambda

export { BrandOverlay } from './compositions/BrandOverlay'
export type { BrandScene, BrandConfig, BrandOverlayProps, AnimationType } from './compositions/BrandOverlay'

export { KenBurnsClip } from './compositions/KenBurnsClip'
export type { KenBurnsClipProps } from './compositions/KenBurnsClip'

export { DynamicComposition } from './compositions/DynamicComposition'

// ── F2 Motion Design ──────────────────────────────────────────────────────────
export { MotionComposition } from './compositions/motion/MotionComposition'
export type {
  MotionCompositionProps,
  MotionScene,
  MotionSceneType,
  MotionSceneProps,
  Scene3DCardsProps,
  SceneHeroTypoProps,
  SceneAvatarGridProps,
  SceneDarkLightProps,
  SceneFloatingIconsProps,
  SceneMockupZoomProps,
  SceneStatsCounterProps,
  SceneLogoRevealProps,
} from './compositions/motion/lib/motion-types'
export { MOTION_DIMENSIONS } from './compositions/motion/lib/motion-types'
