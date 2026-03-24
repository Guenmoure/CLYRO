import { redirect } from 'next/navigation'

/**
 * Route racine — redirige vers le dashboard
 * La landing page marketing est servie séparément (landing/)
 */
export default function HomePage() {
  redirect('/dashboard')
}
