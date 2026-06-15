'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

/* ------------------------------------------------------------------ */
/*  easeOutExpo: fast start, gentle deceleration                      */
/* ------------------------------------------------------------------ */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/* ------------------------------------------------------------------ */
/*  useCountUp – animates from 0 → target over `duration` ms          */
/* ------------------------------------------------------------------ */
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!started) return;

    let raf: number;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      setValue(Math.round(easedProgress * target));

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return { value, start };
}

/* ------------------------------------------------------------------ */
/*  Stats data                                                         */
/* ------------------------------------------------------------------ */
interface StatItem {
  value: number | null; // null = static text (no animation)
  suffix: string;
  prefix: string;
  display?: string; // static display override
  labelKey: string;
}

const stats: StatItem[] = [
  { value: 50000, suffix: '+', prefix: '', labelKey: 'lp_statVideos' },
  { value: 14, suffix: '', prefix: '', labelKey: 'lp_statStyles' },
  { value: 32, suffix: '+', prefix: '', labelKey: 'lp_statLanguages' },
  { value: null, suffix: '', prefix: '', display: '< 5 min', labelKey: 'lp_statGenTime' },
];

/* ------------------------------------------------------------------ */
/*  AnimatedStat                                                       */
/* ------------------------------------------------------------------ */
function AnimatedStat({
  item,
  inView,
}: {
  item: StatItem & { translatedLabel: string };
  inView: boolean;
}) {
  const { value: animatedValue, start } = useCountUp(item.value ?? 0, 2000);

  useEffect(() => {
    if (inView && item.value !== null) {
      start();
    }
  }, [inView, item.value, start]);

  const displayValue =
    item.value === null
      ? item.display
      : `${item.prefix}${animatedValue.toLocaleString()}${item.suffix}`;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <span
        className={cn(
          'font-display text-3xl md:text-4xl font-bold',
          'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-clip-text text-transparent',
        )}
      >
        {displayValue}
      </span>
      <span className="font-body text-sm text-[--text-secondary]">
        {item.translatedLabel}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsBar                                                           */
/* ------------------------------------------------------------------ */
export function StatsBar() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // trigger once
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn(
        'w-full py-16',
        'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5',
        'border-y border-border/30',
      )}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((item) => (
            <AnimatedStat key={item.labelKey} item={{ ...item, translatedLabel: t(item.labelKey) }} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

