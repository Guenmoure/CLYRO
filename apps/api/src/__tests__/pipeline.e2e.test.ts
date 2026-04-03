/**
 * Tests E2E du pipeline Motion + Faceless
 *
 * Ces tests appellent les vraies APIs externes (Claude, fal.ai, ElevenLabs).
 * Ils sont désactivés par défaut (skip) et doivent être lancés manuellement
 * avec les vraies clés d'API dans l'environnement :
 *
 *   RUN_E2E=true npx jest pipeline.e2e --testTimeout=300000
 */

import { runMotionPipeline } from '../pipelines/motion'
import { runFacelessPipeline } from '../pipelines/faceless'
import { supabaseAdmin } from '../lib/supabase'

const RUN_E2E = process.env.RUN_E2E === 'true'
const SKIP = !RUN_E2E

const TEST_USER_ID    = process.env.TEST_USER_ID    ?? 'test-user-e2e'
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'test@clyro.app'

// ── Helpers ───────────────────────────────────────────────────────────────

async function getVideoStatus(videoId: string) {
  const { data } = await supabaseAdmin
    .from('videos')
    .select('status, output_url, metadata')
    .eq('id', videoId)
    .single()
  return data
}

async function cleanupVideo(videoId: string) {
  await supabaseAdmin.from('videos').delete().eq('id', videoId)
  await supabaseAdmin.storage.from('videos').remove([`${TEST_USER_ID}/${videoId}/output.mp4`])
}

// ── Motion pipeline E2E ───────────────────────────────────────────────────

describe('Motion Pipeline E2E', () => {
  let videoId: string

  beforeAll(async () => {
    if (SKIP) return
    // Créer l'entrée vidéo
    const { data } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: TEST_USER_ID,
        module: 'motion',
        style: 'corporate',
        title: 'E2E Motion Test',
        status: 'pending',
        metadata: { progress: 0 },
      })
      .select()
      .single()
    videoId = data!.id
  })

  afterAll(async () => {
    if (SKIP || !videoId) return
    await cleanupVideo(videoId)
  })

  it.skipIf(SKIP)('completes full motion pipeline and produces a video URL', async () => {
    await runMotionPipeline({
      videoId,
      userId:      TEST_USER_ID,
      userEmail:   TEST_USER_EMAIL,
      title:       'E2E Motion Test',
      brief:       'Une entreprise SaaS innovante qui révolutionne la gestion de projet grâce à l\'IA.',
      style:       'corporate',
      format:      '16:9',
      duration:    '15s',
      brandConfig: { primary_color: '#1A237E' },
      voiceId:     process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM',
    })

    const result = await getVideoStatus(videoId)
    expect(result?.status).toBe('done')
    expect(result?.output_url).toBeTruthy()
    expect(result?.output_url).toMatch(/^https?:\/\//)
  }, 5 * 60 * 1000) // 5 min timeout
})

// ── Faceless pipeline E2E ─────────────────────────────────────────────────

describe('Faceless Pipeline E2E', () => {
  let videoId: string

  beforeAll(async () => {
    if (SKIP) return
    const { data } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: TEST_USER_ID,
        module: 'faceless',
        style: 'minimaliste',
        title: 'E2E Faceless Test',
        status: 'pending',
        metadata: { progress: 0 },
      })
      .select()
      .single()
    videoId = data!.id
  })

  afterAll(async () => {
    if (SKIP || !videoId) return
    await cleanupVideo(videoId)
  })

  it.skipIf(SKIP)('completes full faceless pipeline and produces a video URL', async () => {
    await runFacelessPipeline({
      videoId,
      userId:    TEST_USER_ID,
      userEmail: TEST_USER_EMAIL,
      title:     'E2E Faceless Test',
      style:     'minimaliste',
      script:    'Bienvenue dans le futur de la création vidéo. Avec CLYRO, générez des vidéos professionnelles en quelques minutes grâce à l\'intelligence artificielle.',
      voiceId:   process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM',
    })

    const result = await getVideoStatus(videoId)
    expect(result?.status).toBe('done')
    expect(result?.output_url).toBeTruthy()
  }, 5 * 60 * 1000)
})
