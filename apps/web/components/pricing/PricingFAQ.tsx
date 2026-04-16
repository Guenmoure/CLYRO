import { Plus } from 'lucide-react'

const QUESTIONS = [
  {
    q: "What exactly is a credit?",
    a: "A credit is an abstract generation unit. It hides the complexity of real GPU costs behind a simple number. Consumption depends on animation mode (Storyboard, Fast, Pro) and your video duration. See the calculator above for details.",
  },
  {
    q: "What happens if I use all my credits?",
    a: "You'll get a notification when you have 20% credits left. At 0, generation is blocked and you're prompted to buy a top-up or wait for monthly renewal. Your in-progress projects are not deleted.",
  },
  {
    q: "Do unused credits expire?",
    a: "No, never. Unused monthly credits automatically roll over to the next month. Top-up credits accumulate with no expiration date. You build up a balance over time.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes. Upgrade is immediate (new credits available right away). Downgrade takes effect at your next renewal date. Cancellation: your plan stays active until the end of your paid period, then automatically switches to Free.",
  },
  {
    q: "Is Pro Animation quality really worth the extra credits?",
    a: "For scenes with complex animated characters, yes definitely. For wide shots, backgrounds, and text content, Fast Animation delivers nearly identical results for 3x fewer credits. Our recommendation: start with Fast and use Pro selectively for key scenes.",
  },
  {
    q: "Is Mobile Money available for all plans?",
    a: "Mobile Money payment (Orange Money, Wave, MTN, Moov) is available starting with the Studio plan. For other plans, payment is by international bank card via Stripe.",
  },
]

export function PricingFAQ() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Frequently asked questions
          </h2>
          <p className="font-body text-[--text-secondary]">
            Everything you need to know about CLYRO pricing.
          </p>
        </div>

        <div className="space-y-2">
          {QUESTIONS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-border open:border-blue-500/30"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4">
                <span className="font-display text-base font-semibold text-foreground">
                  {item.q}
                </span>
                <Plus
                  size={16}
                  className="shrink-0 text-[--text-secondary] transition-transform group-open:rotate-45"
                />
              </summary>
              <div className="px-5 pb-4 -mt-1 font-body text-sm text-[--text-secondary] leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
