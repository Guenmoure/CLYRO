import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

// Display — titres, marque, UI bold (charte v2)
const plusJakarta = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  variable: '--font-plus-jakarta',
  display:  'swap',
  weight:   ['300', '400', '500', '600', '700', '800'],
})

// Body — corps de texte principal (charte v2)
const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
})

// Mono — code, tags, labels techniques
const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains-mono',
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'CLYRO — AI Video Generation Platform',
  description:
    'De ton script à ta vidéo en moins de 10 minutes. Sans caméra, sans monteur, sans agence.',
  keywords: ['AI video', 'faceless videos', 'motion graphics', 'video generation'],
  openGraph: {
    title: 'CLYRO',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
