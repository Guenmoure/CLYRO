'use client';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

const companies = [
  'TechCorp',
  'MediaFlow',
  'CreativeHub',
  'DigitalAge',
  'StreamLine',
  'VisionPro',
  'ContentFirst',
  'BrandLab',
  'ScaleUp',
  'NextWave',
  'DataPulse',
  'CloudNine',
];

export function LogoBar({ className }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <section
      className={cn(
        'relative w-full overflow-hidden border-y border-border/30 bg-background py-10',
        className,
      )}
    >
      {/* Heading */}
      <p className="mb-8 text-center font-body text-sm tracking-wide text-[--text-muted]">
        {t('lp_trustedBy')}
      </p>

      {/* Scrolling track */}
      <div className="relative flex w-full overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

        {/* Animated strip — duplicated for seamless loop */}
        <div className="animate-logo-scroll flex shrink-0 items-center gap-12">
          {companies.map((name) => (
            <span
              key={name}
              className="whitespace-nowrap font-display text-lg uppercase tracking-wider text-[--text-secondary] opacity-40 grayscale transition-opacity hover:opacity-70"
            >
              {name}
            </span>
          ))}
        </div>

        <div
          aria-hidden
          className="animate-logo-scroll flex shrink-0 items-center gap-12"
        >
          {companies.map((name) => (
            <span
              key={`dup-${name}`}
              className="whitespace-nowrap font-display text-lg uppercase tracking-wider text-[--text-secondary] opacity-40 grayscale transition-opacity hover:opacity-70"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Keyframes injected via style tag */}
      <style jsx global>{`
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }

        .animate-logo-scroll {
          animation: scroll 30s linear infinite;
          padding-right: 3rem; /* matches gap-12 so the seam is invisible */
        }
      `}</style>
    </section>
  );
}
