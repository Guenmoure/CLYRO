import React, { useMemo } from 'react'
import { AbsoluteFill, Sequence, Audio } from 'remotion'
import { Scene3DCards }       from './scenes/Scene3DCards'
import { SceneHeroTypo }      from './scenes/SceneHeroTypo'
import { SceneFloatingIcons } from './scenes/SceneFloatingIcons'
import { SceneAvatarGrid }    from './scenes/SceneAvatarGrid'
import { SceneDarkLightSwitch } from './scenes/SceneDarkLightSwitch'
import { SceneMockupZoom }    from './scenes/SceneMockupZoom'
import { SceneStatsCounter }  from './scenes/SceneStatsCounter'
import { SceneLogoReveal }    from './scenes/SceneLogoReveal'
import type {
  MotionCompositionProps,
  MotionScene,
  MotionSceneProps,
} from './lib/motion-types'

// ── Scene router ─────────────────────────────────────────────────────────────

function renderMotionScene(scene: MotionScene): React.ReactNode {
  const props = scene.props as MotionSceneProps
  switch (props.type) {
    case '3d_cards':
      return <Scene3DCards {...props} />
    case 'hero_typo':
      return <SceneHeroTypo {...props} />
    case 'floating_icons':
      return <SceneFloatingIcons {...props} />
    case 'avatar_grid':
      return <SceneAvatarGrid {...props} />
    case 'dark_light_switch':
      return <SceneDarkLightSwitch {...props} />
    case 'mockup_zoom':
      return <SceneMockupZoom {...props} />
    case 'stats_counter':
      return <SceneStatsCounter {...props} />
    case 'logo_reveal':
      return <SceneLogoReveal {...props} />
    default:
      // Exhaustive fallback — render a blank frame
      return <AbsoluteFill style={{ background: '#000' }} />
  }
}

// ── MotionComposition ─────────────────────────────────────────────────────────

export const MotionComposition: React.FC<MotionCompositionProps> = ({
  scenes,
  musicUrl,
  audioUrl,
}) => {
  // Pre-compute start frame for each scene
  const sequences = useMemo(() => {
    let offset = 0
    return scenes.map((scene) => {
      const start = offset
      offset += Math.max(1, scene.duration)
      return { ...scene, startFrame: start }
    })
  }, [scenes])

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Voiceover */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Background music — ducked to 15% */}
      {musicUrl && <Audio src={musicUrl} volume={0.15} />}

      {sequences.map((seq) => (
        <Sequence
          key={seq.id}
          from={seq.startFrame}
          durationInFrames={Math.max(1, seq.duration)}
        >
          {renderMotionScene(seq)}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
