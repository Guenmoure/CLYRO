import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

// Primary — all UI text (display + body), inspired by HeyGen 2026
const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  weight:   ['400', '500', '600', '700'],
})

// Mono — labels techniques, badges, codes, metadata, step numbers
const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains-mono',
  display:  'swap',
  weight:   ['400', '500'],
})

export const metadata: Metadata = {
  title: 'CLYRO — AI Video Generation Platform',
  description:
    'De ton script à ta vidéo en moins de 10 minutes. Sans caméra, sans monteur, sans agence.',
  keywords: ['AI video', 'faceless videos', 'motion graphics', 'video generation'],
  // Next.js auto-detects /app/icon.svg as the favicon. No manual `icons:`
  // entry needed — adding one with a non-existent path would 404 the browser.
  // When transparent PNG assets are ready, drop them in /public/logo/ and
  // re-add the `icons:` / `openGraph.images` / `twitter.images` blocks below.
  openGraph: {
    title: 'CLYRO',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
    type: 'website',
    siteName: 'CLYRO',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CLYRO',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
