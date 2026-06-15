// app/page.tsx — Landing Page CLYRO
// Server Component — keeps metadata for SEO. Content is client-rendered for i18n.

import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'CLYRO — AI Video Generation in Less Than 5 Minutes',
  description:
    'Paste your script. Choose a style. Your video is ready. Faceless videos, AI avatars, motion design — entirely AI-powered.',
  keywords: ['AI video', 'faceless videos', 'motion graphics', 'brand kit', 'video generation'],
  openGraph: {
    title: 'CLYRO — AI Video Generation',
    description: 'Paste your script. Choose a style. Your video is ready in under 5 minutes.',
    type: 'website',
  },
}

export default function Page() {
  return <LandingPage />
}
