'use client';

import { Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

const TERRACOTTA = '#d37b69';

export function ProblemSection() {
  const t = useTranslations('landing.problem');

  return (
    <section
      id="how"
      className="relative overflow-hidden bg-nham-ink py-32 text-nham-surface lg:py-48"
    >
      {/* Grain Overlay — static texture, no animation */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-16 px-6 lg:grid-cols-2 lg:gap-24">
        {/* Text Content — editorial left column */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div className="mb-8 flex items-center gap-3">
              <div className="h-px w-12 bg-nham-accent" />
              <span className="font-medium text-nham-surface/60 text-xs uppercase tracking-[0.2em]">
                {t('label')}
              </span>
            </div>

            <h2 className="mb-8 font-normal font-serif text-5xl leading-[1.1] lg:text-6xl">
              {t('title')}
              <br />
              <span className="font-light text-nham-accent italic">
                {t('titleHighlight')}
              </span>
            </h2>

            <p className="mb-12 max-w-md font-light font-sans-display text-lg text-nham-surface/70 leading-relaxed">
              {t('subtitle')}
            </p>

            <div className="flex flex-col gap-7 border-nham-surface/10 border-l pl-8">
              {(['card1', 'card2', 'card3'] as const).map((card) => (
                <div key={card}>
                  <h3 className="mb-1.5 font-medium text-lg text-nham-surface">
                    {t(`${card}Title`)}
                  </h3>
                  <p className="text-nham-text-muted text-sm leading-relaxed">
                    {t(`${card}Text`)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* One composed artifact — a Western tracker failing at "mực kho" */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="relative mx-auto w-full max-w-[420px]"
        >
          <div className="overflow-hidden rounded-2xl border border-nham-border/15 bg-nham-surface shadow-2xl">
            <div className="border-nham-border/40 border-b px-5 py-3">
              <span className="font-medium text-[10px] text-nham-text-muted uppercase tracking-[0.2em]">
                {t('visual.appLabel')}
              </span>
            </div>

            {/* Search field */}
            <div className="px-5 pt-5">
              <div className="flex items-center gap-2 rounded-lg border border-nham-border/60 bg-white px-3 py-2.5">
                <Search className="h-4 w-4 text-nham-text-muted" />
                <span className="font-serif text-nham-text text-sm">
                  {t('visual.query')}
                </span>
              </div>
            </div>

            {/* Wrong results */}
            <div className="space-y-2 px-5 pt-4">
              <div className="flex items-center justify-between rounded-lg border border-nham-border/40 px-3 py-2.5">
                <div>
                  <div className="text-nham-text text-sm">
                    {t('visual.result1')}
                  </div>
                  <div className="text-nham-text-muted text-xs">
                    {t('visual.result1Note')}
                  </div>
                </div>
                <span className="font-mono text-nham-text-muted text-xs">
                  92 kcal
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-nham-border/40 px-3 py-2.5">
                <div>
                  <div className="text-nham-text text-sm">
                    {t('visual.result2')}
                  </div>
                  <div className="text-nham-text-muted text-xs">
                    {t('visual.result2Note')}
                  </div>
                </div>
                <span className="font-mono text-nham-text-muted text-xs">
                  175 kcal
                </span>
              </div>
            </div>

            {/* The shrug */}
            <div className="px-5 py-5">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                style={{ backgroundColor: 'rgba(211,123,105,0.12)' }}
              >
                <X className="h-4 w-4" style={{ color: TERRACOTTA }} />
                <span
                  className="font-medium text-sm"
                  style={{ color: TERRACOTTA }}
                >
                  {t('visual.noMatch')}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-5 px-1 font-light text-nham-text-muted text-sm italic leading-relaxed">
            {t('visual.caption')}
          </p>
        </motion.div>
      </div>

      {/* Featured Quote — espresso interlude kept */}
      <div className="relative z-10 mx-auto mt-24 max-w-[1200px] px-6 lg:mt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative border-nham-accent/20 border-t pt-16 text-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-nham-ink px-4 text-nham-surface/60">
            <span className="font-serif text-4xl">&quot;</span>
          </div>

          <p className="mx-auto max-w-4xl font-serif text-2xl text-nham-border italic leading-normal lg:text-3xl">
            {t('quote')}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-nham-accent/50" />
            <span className="font-medium text-nham-text-muted text-xs uppercase tracking-[0.2em]">
              {t('quoteLabel')}
            </span>
            <div className="h-px w-8 bg-nham-accent/50" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
