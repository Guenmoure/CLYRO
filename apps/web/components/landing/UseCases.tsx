'use client';

import { useState } from 'react';
import { Video, BarChart3, Building2, Rocket, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const useCases = [
  {
    label: 'Content Creators',
    icon: Video,
    title: 'Scale your content without scaling your team',
    description:
      'Create faceless videos for YouTube, TikTok, and Instagram in minutes. Choose from 14 visual styles, add AI voiceover, and publish daily without burnout.',
    bullets: [
      '14 visual styles including Cinematic, 2D Animation, Whiteboard',
      'AI voiceover in 32+ languages with karaoke subtitles',
      'Regenerate individual scenes — no need to restart from scratch',
    ],
    gradient: 'from-purple-500/20 via-pink-500/20 to-rose-500/20',
  },
  {
    label: 'Marketing Teams',
    icon: BarChart3,
    title: 'Professional video ads without the agency price tag',
    description:
      'Launch product demos, social ads, and animated presentations. Motion Design module gives you After Effects\u2013quality output from a simple text brief.',
    bullets: [
      'Motion Design for product launches and animated ads',
      'All formats: 16:9, 9:16, 1:1 — ready for every platform',
      'Brand Kit ensures visual consistency across all assets',
    ],
    gradient: 'from-blue-500/20 via-cyan-500/20 to-teal-500/20',
  },
  {
    label: 'Agencies',
    icon: Building2,
    title: 'Deliver more to clients with less overhead',
    description:
      'White-label video production and brand identity generation. Create complete brand kits with logos, color palettes, and guidelines PDF in 15 minutes.',
    bullets: [
      'Complete brand identity from a text brief',
      '3 creative directions with WCAG-compliant palettes',
      'Export brand kit ZIP: logos, colors, fonts, charter PDF',
    ],
    gradient: 'from-amber-500/20 via-orange-500/20 to-red-500/20',
  },
  {
    label: 'Entrepreneurs',
    icon: Rocket,
    title: 'Launch your brand and content from day one',
    description:
      'Whether you\u2019re in Lagos, Paris, or S\u00e3o Paulo \u2014 CLYRO gives you studio-quality video and branding tools at a fraction of the cost. Mobile Money supported.',
    bullets: [
      '250 free credits on signup — no credit card required',
      'Mobile Money payments: Orange Money, Wave, MTN',
      'AI Avatar Studio for professional presentations',
    ],
    gradient: 'from-emerald-500/20 via-green-500/20 to-lime-500/20',
  },
];

export function UseCases() {
  const [activeTab, setActiveTab] = useState(0);
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
                key={useCase.label}
                onClick={() => setActiveTab(index)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-3 text-sm font-body rounded-lg transition-colors duration-200',
                  isActive
                    ? 'text-foreground font-semibold'
                    : 'text-[--text-secondary] hover:text-foreground'
                )}
              >
                <TabIcon className="h-4 w-4" />
                {useCase.label}
                {/* Gradient underline for active tab */}
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
                {current.label}
              </span>
            </div>

            <h3 className="font-display text-2xl md:text-3xl font-bold">
              {current.title}
            </h3>

            <p className="font-body text-[--text-secondary] leading-relaxed">
              {current.description}
            </p>

            <ul className="space-y-4 pt-2">
              {current.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="font-body text-sm text-[--text-secondary]">
                    {bullet}
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
