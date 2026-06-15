'use client';

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useLanguage } from '@/lib/i18n';

const testimonials = [
  {
    quote:
      "CLYRO cut our video production time by 90%. We went from one video per week to five per day.",
    name: "Sarah M.",
    role: "Content Creator, YouTube · 1.2M subs",
    initial: "S",
  },
  {
    quote:
      "The Avatar Studio is a game-changer. Our sales demos look professional without hiring actors.",
    name: "Marcus K.",
    role: "Head of Marketing, TechFlow",
    initial: "M",
  },
  {
    quote:
      "We generate all our social media content with CLYRO. The ROI is insane — $49/mo replaces a $3,000/mo agency.",
    name: "Amara O.",
    role: "Founder, GrowthLab",
    initial: "A",
  },
  {
    quote:
      "The Faceless video quality blew my mind. Cinematic style looks like a Netflix trailer.",
    name: "David L.",
    role: "YouTuber · 850K subs",
    initial: "D",
  },
  {
    quote:
      "Brand Kit saved us weeks of back-and-forth with designers. We got our complete identity in 15 minutes.",
    name: "Fatou D.",
    role: "CEO, AfriPay",
    initial: "F",
  },
  {
    quote:
      "Motion Design module is perfect for our product launches. We create professional ads in minutes, not weeks.",
    name: "James R.",
    role: "Marketing Director, NovaTech",
    initial: "J",
  },
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
      {testimonials.map((item) => (
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
            {item.quote}
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
                {item.role}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
