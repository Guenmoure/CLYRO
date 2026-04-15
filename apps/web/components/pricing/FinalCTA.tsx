import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section className="relative px-6 py-24 overflow-hidden">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center space-y-6">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">
          Commence avec{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            250 crédits gratuits
          </span>
        </h2>

        <p className="font-body text-lg text-[--text-secondary] max-w-xl mx-auto">
          Aucune carte bancaire. Aucun engagement. Juste 250 crédits pour voir ce que CLYRO peut faire.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button variant="primary" size="lg" rightIcon={<ArrowRight size={16} />} asChild>
            <Link href="/signup">Créer mon compte gratuitement</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link href="/#examples">Voir les exemples →</Link>
          </Button>
        </div>

        <p className="font-mono text-xs text-[--text-muted] pt-2">
          ✓ 500+ créateurs actifs
          {' · '}✓ 2 000+ vidéos générées
          {' · '}✓ Crédits sans expiration
          {' · '}✓ Support réactif
        </p>
      </div>
    </section>
  )
}
