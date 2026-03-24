import { logger } from '../lib/logger'

/**
 * ============================================================
 * SERVICE REMOTION — Assemblage Motion Graphics
 * À configurer complètement en Phase 4
 * ============================================================
 *
 * TODO Phase 4 :
 * 1. npm install @remotion/renderer remotion
 * 2. Créer la composition BrandOverlay.tsx (voir ARCHITECTURE.md section 5.2)
 * 3. Configurer le rendu serveur-side (@remotion/renderer)
 * 4. Décommenter l'implémentation
 * ============================================================
 */

interface BrandConfig {
  logo_url?: string
  primary_color: string
  secondary_color?: string
  font_family?: string
}

interface Scene {
  id: string
  description_visuelle: string
  texte_voix: string
  duree_estimee: number
  image_url?: string
}

interface RenderMotionVideoOptions {
  scenes: Scene[]
  brandConfig: BrandConfig
  format: string
  duration: string
}

/**
 * Rend une vidéo Motion Graphics avec les overlays de marque
 * Retourne un Buffer MP4
 *
 * TODO Phase 4 : implémenter avec @remotion/renderer
 */
export async function renderMotionVideo(
  _options: RenderMotionVideoOptions
): Promise<Buffer> {
  logger.warn('Remotion: not yet implemented (Phase 4)')

  // TODO Phase 4 :
  // const { renderMedia, selectComposition } = await import('@remotion/renderer')
  //
  // const composition = await selectComposition({
  //   serveUrl: path.join(__dirname, '../remotion/bundle'),
  //   id: 'BrandOverlay',
  //   inputProps: {
  //     scenes: options.scenes,
  //     brandConfig: options.brandConfig,
  //   },
  // })
  //
  // const outputPath = join(tmpdir(), `remotion-${randomUUID()}.mp4`)
  //
  // await renderMedia({
  //   composition,
  //   serveUrl: path.join(__dirname, '../remotion/bundle'),
  //   codec: 'h264',
  //   outputLocation: outputPath,
  //   inputProps: {
  //     scenes: options.scenes,
  //     brandConfig: options.brandConfig,
  //   },
  // })
  //
  // const buffer = await readFile(outputPath)
  // await unlink(outputPath)
  // return buffer

  throw new Error('Remotion rendering is not yet configured (Phase 4)')
}
