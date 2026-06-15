'use client';

import { useState } from 'react';
import { Video, BarChart3, Building2, Rocket, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';

interface UseCaseConfig {
  labelKey: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  bulletKeys: string[];
  gradient: string;
}

const useCases: UseCaseConfig[] = [
  {
    labelKey: 'lp_ucLabel1',
    icon: Video,
    titleKey: 'lp_ucTitle1',
    descKey: 'lp_ucDesc1',
    bulletKeys: ['lp_ucBullet1_1', 'lp_ucBullet1_2', 'lp_ucBullet1_3'],
    gradient: 'from-purple-500/20 via-pink-500/20 to-rose-500/20',
  },
  {
    labelKey: 'lp_ucLabel2',
    icon: BarChart3,
    titleKey: 'lp_ucTitle2',
    descKey: 'lp_ucDesc2',
    bulletKeys: ['lp_ucBullet2_1', 'lp_ucBullet2_2', 'lp_ucBullet2_3'],
    gradient: 'from-blue-500/20 via-cyan-500/20 to-teal-500/20',
  },
  {
    labelKey: 'lp_ucLabel3',
    icon: Building2,
    titleKey: 'lp_ucTitle3',
    descKey: 'lp_ucDesc3',
    bulletKeys: ['lp_ucBullet3_1', 'lp_ucBullet3_2', 'lp_ucBullet3_3'],
    gradient: 'from-amber-500/20 via-orange-500/20 to-red-500/20',
  },
  {
    labelKey: 'lp_ucLabel4',
    icon: Rocket,
    titleKey: 'lp_ucTitle4',
    descKey: 'lp_ucDesc4',
    bulletKeys: ['lp_ucBullet4_1', 'lp_ucBullet4_2', 'lp_ucBullet4_3'],
    gradient: 'from-emerald-500/20 via-green-500/20 to-lime-500/20',
  },
];

export function UseCases() {
  const [activeTab, setActiveTab] = useState(0);
  const { t } = useLanguage();
  const current = useCases[activeTab];
  const IconComponent = current.icon;

  return (
    <div className="reveal">
      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-1 mb-12">
          {useCases.map((useCase, index) => {
            const TabIcon = useCase.icon;
            const isActive = activeTab === index;

            return (
              <button
                type="button"
                key={useCase.labelKey}
                onClick={() => setActiveTab(index)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-3 text-sm font-body rounded-lg transition-colors duration-200',
                  isActive
                    ? 'text-foreground font-semibold'
                    : 'text-[--text-secondary] hover:text-foreground'
                )}
              >
                <TabIcon className="h-4 w-4" />
                {t(useCase.labelKey)}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div
          key={activeTab}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          {/* Left side: text content */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                <IconComponent className="h-5 w-5 text-purple-400" />
              </div>
              <span className="font-mono text-xs uppercase tracking-wider text-[--text-secondary]">
                {t(current.labelKey)}
              </span>
            </div>

            <h3 className="font-display text-2xl md:text-3xl font-bold">
              {t(current.titleKey)}
            </h3>

            <p className="font-body text-[--text-secondary] leading-relaxed">
              {t(current.descKey)}
            </p>

            <ul className="space-y-4 pt-2">
              {current.bulletKeys.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="font-body text-sm text-[--text-secondary]">
                    {t(key)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right side: visual preview */}
          <Card className="overflow-hidden border-[--border-primary]">
            <div
              className={cn(
                'aspect-video w-full bg-gradient-to-br',
                current.gradient,
                'flex items-center justify-center'
              )}
            >
              <IconComponent className="h-16 w-16 text-foreground/20" />
            </div>
          </Card>
        </div>
    </div>
  );
}
