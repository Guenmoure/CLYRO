'use client'

import { useLanguage } from '@/lib/i18n'
import { MotionDesignWizard } from '@/components/motion/motion-design-wizard'

export default function MotionDesignPage() {
  const { t } = useLanguage()
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <a href="/motion/hub" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Motion Hub
          </a>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">F2 Motion Design</h1>
        <p className="font-body text-sm text-muted-foreground">
          {t('md_pageSubtitle')}
        </p>
      </div>
      <MotionDesignWizard />
    </div>
  )
}
