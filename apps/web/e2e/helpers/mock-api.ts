import type { Page } from '@playwright/test'

/**
 * Intercept and mock CLYRO backend API calls so pipeline tests
 * don't hit real AI services (ElevenLabs, fal.ai, Claude).
 */

export async function mockPipelineAnalyze(page: Page, scenes = mockScenes()) {
  await page.route('**/api/v1/pipeline/faceless/analyze', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ scenes, video_id: 'mock-video-id-001' }),
    })
  })
}

export async function mockPipelineRun(page: Page) {
  await page.route('**/api/v1/pipeline/faceless/run', (route) => {
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'mock-job-001', status: 'queued' }),
    })
  })
}

export async function mockVideoStatus(page: Page, status = 'done', progress = 100) {
  await page.route('**/api/v1/videos/**/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status,
        progress,
        download_url: status === 'done' ? 'https://example.com/video.mp4' : null,
      }),
    })
  })
}

export async function mockCreditsCheck(page: Page, allowed = true) {
  if (!allowed) {
    await page.route('**/api/v1/pipeline/**', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INSUFFICIENT_CREDITS', creditsNeeded: 120, creditsLeft: 10 }),
      })
    })
  }
}

export async function mockAvatarList(page: Page) {
  await page.route('**/api/v1/assets/avatars', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        avatars: [
          { avatar_id: 'av1', avatar_name: 'Aria', preview_image_url: '', tags: ['professional'] },
          { avatar_id: 'av2', avatar_name: 'Josh', preview_image_url: '', tags: ['lifestyle'] },
        ],
      }),
    })
  })
}

export async function mockVoicesList(page: Page) {
  await page.route('**/api/v1/assets/voices', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        voices: [
          { voice_id: 'v1', name: 'Alistair', preview_url: '/audio/sample.mp3', labels: { accent: 'british' } },
          { voice_id: 'v2', name: 'Maria', preview_url: '/audio/sample2.mp3', labels: { accent: 'american' } },
        ],
      }),
    })
  })
}

function mockScenes() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `scene-${i + 1}`,
    index: i,
    text: `Scene ${i + 1} script content about an interesting topic.`,
    duration_s: 6,
    image_prompt: `Cinematic shot of scene ${i + 1}`,
    animation_mode: 'storyboard',
    status: 'pending',
  }))
}
