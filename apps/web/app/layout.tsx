import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

// Display — titres H1/H2, boutons, logo CLYRO, labels navigation
const syne = Syne({
  subsets:  ['latin'],
  variable: '--font-syne',
  display:  'swap',
  weight:   ['400', '600', '700'],
})

// Body — corps de texte, descriptions, paragraphes
const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-dm-sans',
  display:  'swap',
  weight:   ['400', '500'],
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
  // Drop the following files into /public/logo/ to activate:
  //   favicon.ico, apple-touch-icon.png, og-image.png
  icons: {
    icon: [
      { url: '/logo/favicon.ico' },
    ],
    apple: [
      { url: '/logo/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'CLYRO',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
    type: 'website',
    siteName: 'CLYRO',
    images: [
      { url: '/logo/og-image.png', width: 1200, height: 630, alt: 'CLYRO — AI Video Generation' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CLYRO',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
    images: ['/logo/og-image.png'],
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
        className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
