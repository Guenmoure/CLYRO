'use client';

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useLanguage } from '@/lib/i18n';

const TESTIMONIALS = [
  { quoteKey: 'lp_test1Quote', name: 'Sarah M.',  roleKey: 'lp_test1Role', initial: 'S' },
  { quoteKey: 'lp_test2Quote', name: 'Marcus K.', roleKey: 'lp_test2Role', initial: 'M' },
  { quoteKey: 'lp_test3Quote', name: 'Amara O.',  roleKey: 'lp_test3Role', initial: 'A' },
  { quoteKey: 'lp_test4Quote', name: 'David L.',  roleKey: 'lp_test4Role', initial: 'D' },
  { quoteKey: 'lp_test5Quote', name: 'Fatou D.',  roleKey: 'lp_test5Role', initial: 'F' },
  { quoteKey: 'lp_test6Quote', name: 'James R.',  roleKey: 'lp_test6Role', initial: 'J' },
];

function StarRating({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="flex gap-0.5" aria-label={ariaLabel}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className="h-4 w-4 text-yellow-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 stagger">
      {TESTIMONIALS.map((item) => (
        <Card
          key={item.name}
          className={cn(
            "reveal",
            "bg-card border border-border/50 rounded-2xl p-6",
            "transition-all duration-300",
            "hover:border-border hover:shadow-card-hover"
          )}
        >
          {/* Quote icon */}
          <span
            className="block font-display text-4xl leading-none text-[--text-muted] select-none"
            aria-hidden="true"
          >
            &ldquo;
          </span>

          {/* Quote text */}
          <p className="mt-2 font-body text-sm text-[--text-secondary] leading-relaxed">
            {t(item.quoteKey)}
          </p>

          {/* Star rating */}
          <div className="mt-4">
            <StarRating ariaLabel={t('lp_stars5')} />
          </div>

          {/* Author */}
          <div className="mt-5 flex items-center gap-3">
            {/* Avatar initial circle */}
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                "bg-gradient-to-br from-blue-500 to-purple-500",
                "font-display text-sm font-semibold text-white"
              )}
            >
              {item.initial}
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {item.name}
              </p>
              <p className="font-mono text-xs text-[--text-muted]">
                {t(item.roleKey)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
