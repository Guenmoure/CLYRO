'use client'

import { Plus } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

const QUESTION_KEYS = [
  { qKey: 'pr_faq1Q', aKey: 'pr_faq1A' },
  { qKey: 'pr_faq2Q', aKey: 'pr_faq2A' },
  { qKey: 'pr_faq3Q', aKey: 'pr_faq3A' },
  { qKey: 'pr_faq4Q', aKey: 'pr_faq4A' },
  { qKey: 'pr_faq5Q', aKey: 'pr_faq5A' },
  { qKey: 'pr_faq6Q', aKey: 'pr_faq6A' },
]

export function PricingFAQ() {
  const { t } = useLanguage()

  return (
    <section className="px-6 py-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {t('pr_faqTitle')}
          </h2>
          <p className="font-body text-[--text-secondary]">
            {t('pr_faqSubtitle')}
          </p>
        </div>

        <div className="space-y-2">
          {QUESTION_KEYS.map((item) => (
            <details
              key={item.qKey}
              className="group rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-border open:border-blue-500/30"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4">
                <span className="font-display text-base font-semibold text-foreground">
                  {t(item.qKey)}
                </span>
                <Plus
                  size={16}
                  className="shrink-0 text-[--text-secondary] transition-transform group-open:rotate-45"
                />
              </summary>
              <div className="px-5 pb-4 -mt-1 font-body text-sm text-[--text-secondary] leading-relaxed">
                {t(item.aKey)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
