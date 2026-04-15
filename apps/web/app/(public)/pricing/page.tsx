import { PlansSection } from '@/components/pricing/PlansSection'
import { PricingCalculator } from '@/components/pricing/PricingCalculator'
import { AnimationModes } from '@/components/pricing/AnimationModes'
import { CreditTopups } from '@/components/pricing/CreditTopups'
import { PricingFAQ } from '@/components/pricing/PricingFAQ'
import { FinalCTA } from '@/components/pricing/FinalCTA'

export const metadata = {
  title: 'Tarifs — CLYRO',
  description:
    'Crée. Publie. Répète. Des crédits simples, un roll-over permanent, et des modes d\'animation adaptés à tous les créateurs.',
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* 1. Header + plans grid (client island handles the monthly/yearly toggle) */}
      <PlansSection />

      {/* 2. Credit calculator (client) */}
      <PricingCalculator />

      {/* 3. Animation modes comparison (server) */}
      <AnimationModes />

      {/* 4. Top-ups (client) */}
      <CreditTopups />

      {/* 5. FAQ (server — native <details>) */}
      <PricingFAQ />

      {/* 6. Final CTA (server) */}
      <FinalCTA />
    </main>
  )
}
