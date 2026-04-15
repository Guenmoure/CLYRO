import { Sparkles } from 'lucide-react'

interface ComingSoonSectionProps {
  title: string
  description: string
}

export function ComingSoonSection({ title, description }: ComingSoonSectionProps) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
      </div>

      <div className="flex flex-col items-center justify-center text-center py-12 px-8 rounded-2xl border border-dashed border-border bg-muted/30">
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-2xl" />
          <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-border flex items-center justify-center">
            <Sparkles size={28} className="text-blue-500" />
          </div>
        </div>
        <p className="font-display text-lg font-semibold text-foreground mb-2">
          Bientôt disponible
        </p>
        <p className="font-body text-sm text-[--text-secondary] max-w-md">
          {description}
        </p>
      </div>
    </div>
  )
}
