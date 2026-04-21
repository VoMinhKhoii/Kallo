'use client';

import { AlertCircle, Search, UtensilsCrossed, X } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

export function ProblemSection() {
  const t = useTranslations('landing.problem');
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [-2, 3]);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-[#2C2416] py-32 text-[#FEFBF6] lg:py-48"
    >
      {/* Grain Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Background Typography */}
      <div className="pointer-events-none absolute top-20 left-0 w-full select-none overflow-hidden opacity-[0.03]">
        <motion.div
          animate={{ x: [0, -1000] }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="whitespace-nowrap font-bold font-serif text-[20vw] leading-none tracking-tighter"
        >
          404 NOT FOUND 404 NOT FOUND 404 NOT FOUND 404 NOT FOUND
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1600px] items-center gap-16 px-6 lg:grid-cols-12 lg:gap-20">
        {/* Text Content — Left Column */}
        <div className="relative lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'circOut' }}
          >
            <div className="mb-8 flex items-center gap-3">
              <div className="h-px w-12 bg-[#C9A87C]" />
              <span className="font-mono text-[#C9A87C] text-sm uppercase tracking-widest">
                {t('label')}
              </span>
            </div>

            <h2
              className="mb-8 font-normal text-5xl leading-[1.1] lg:text-7xl"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {t('title')}
              <br />{' '}
              <span className="bg-gradient-to-r from-[#C9A87C] to-[#E8D5B5] bg-clip-text text-transparent italic">
                {t('titleHighlight')}
              </span>
            </h2>

            <p
              className="mb-12 max-w-md font-light text-[#B0A695] text-xl leading-relaxed"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('subtitle')}
            </p>

            <div className="flex flex-col gap-6 border-[#FEFBF6]/10 border-l pl-8">
              <div className="group">
                <h3 className="mb-2 font-medium text-[#FEFBF6] text-xl transition-colors group-hover:text-[#C9A87C]">
                  {t('card1Title')}
                </h3>
                <p className="text-[#8B7355] text-sm">{t('card1Text')}</p>
              </div>
              <div className="group">
                <h3 className="mb-2 font-medium text-[#FEFBF6] text-xl transition-colors group-hover:text-[#C9A87C]">
                  {t('card2Title')}
                </h3>
                <p className="text-[#8B7355] text-sm">{t('card2Text')}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Visual Evidence — Desktop (parallax floating cards) */}
        <div
          className="relative hidden h-[600px] w-full lg:col-span-7 lg:block"
          style={{ perspective: '1000px' }}
        >
          {/* Blueprint Grid */}
          <div
            className="absolute inset-0 z-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(#E8D5B5 1px, transparent 1px), linear-gradient(90deg, #E8D5B5 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Card 1: Search Confusion */}
          <motion.div
            style={{ y: y1, rotate: rotate1 }}
            className="absolute top-[8%] left-[8%] z-20 w-[300px] rounded-xl border border-[#E8D5B5]/20 bg-[#FEFBF6] p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center gap-2 border-[#E8D5B5]/30 border-b pb-3">
              <Search className="h-4 w-4 text-[#8B7355]" />
              <span className="text-[#2C2416] text-sm">
                {t('visual.searchPlaceholder')}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg p-2 text-[#8B7355] text-xs">
                <span>{t('visual.searchResult1')}</span>
                <span className="font-mono">120 kcal</span>
              </div>
              <div className="flex items-center justify-between rounded-lg p-2 text-[#8B7355] text-xs">
                <span>{t('visual.searchResult2')}</span>
                <span className="font-mono">0 kcal</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-2 font-medium text-red-500 text-xs">
                <span>{t('visual.noMatch')}</span>
                <AlertCircle className="h-3 w-3" />
              </div>
            </div>
          </motion.div>

          {/* Card 2: Hidden Calories */}
          <motion.div
            style={{ y: y2 }}
            className="absolute top-[28%] right-[5%] z-10 w-[260px] rounded-2xl border border-[#C9A87C]/10 bg-[#1A1510] p-5 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2C2416]">
                <UtensilsCrossed className="h-5 w-5 text-[#8B7355]" />
              </div>
              <div>
                <div className="mb-1 text-[#8B7355] text-xs">
                  {t('visual.detected')}
                </div>
                <div className="font-bold text-[#FEFBF6] text-lg">
                  {t('visual.braisedPork')}
                </div>
                <div className="mt-1 font-mono text-green-400 text-sm">
                  250 kcal
                </div>
              </div>
            </div>
            <div className="relative mt-4 overflow-hidden border-[#C9A87C]/10 border-t pt-4">
              <div className="absolute inset-0 animate-pulse bg-red-500/5" />
              <div className="relative flex items-center justify-between text-xs">
                <span className="font-medium text-red-400">
                  {t('visual.hiddenCalories')}
                </span>
                <span className="font-bold font-mono text-red-400">
                  +180 kcal
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Entry Error */}
          <motion.div
            style={{ y: y3, rotate: -2 }}
            className="absolute bottom-[10%] left-[28%] z-30 flex w-[220px] flex-col items-center rounded-xl border border-[#E8D5B5]/20 bg-white p-6 text-center shadow-xl"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <h4 className="mb-1 font-bold text-[#2C2416]">
              {t('visual.entryFailed')}
            </h4>
            <p className="text-[#8B7355] text-xs leading-tight">
              {t('visual.entryFailedText')}
            </p>
          </motion.div>
        </div>

        {/* Visual Evidence — Mobile (clean grid) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-[#E8D5B5]/20 bg-[#FEFBF6] p-5 shadow-lg"
          >
            <div className="mb-3 flex items-center gap-2 border-[#E8D5B5]/30 border-b pb-3">
              <Search className="h-4 w-4 text-[#8B7355]" />
              <span className="text-[#2C2416] text-sm">
                {t('visual.searchPlaceholder')}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 text-[#8B7355] text-xs">
                <span>{t('visual.searchResult1')}</span>
                <span className="font-mono">120 kcal</span>
              </div>
              <div className="flex items-center justify-between p-2 text-[#8B7355] text-xs">
                <span>{t('visual.searchResult2')}</span>
                <span className="font-mono">0 kcal</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-2 font-medium text-red-500 text-xs">
                <span>{t('visual.noMatch')}</span>
                <AlertCircle className="h-3 w-3" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-[#C9A87C]/10 bg-[#1A1510] p-5 shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2C2416]">
                <UtensilsCrossed className="h-5 w-5 text-[#8B7355]" />
              </div>
              <div>
                <div className="mb-1 text-[#8B7355] text-xs">
                  {t('visual.detected')}
                </div>
                <div className="font-bold text-[#FEFBF6]">
                  {t('visual.braisedPork')}
                </div>
                <div className="mt-1 font-mono text-green-400 text-sm">
                  250 kcal
                </div>
              </div>
            </div>
            <div className="mt-4 border-[#C9A87C]/10 border-t pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-red-400">
                  {t('visual.hiddenCalories')}
                </span>
                <span className="font-bold font-mono text-red-400">
                  +180 kcal
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center rounded-xl border border-[#E8D5B5]/20 bg-white p-6 text-center shadow-lg sm:col-span-2 sm:mx-auto sm:max-w-[280px]"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <h4 className="mb-1 font-bold text-[#2C2416]">
              {t('visual.entryFailed')}
            </h4>
            <p className="text-[#8B7355] text-xs leading-tight">
              {t('visual.entryFailedText')}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Featured Quote */}
      <div className="relative z-10 mx-auto mt-24 max-w-[1200px] px-6 lg:mt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative border-[#C9A87C]/20 border-t pt-16 text-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2C2416] px-4 text-[#C9A87C]">
            <span className="font-serif text-4xl">&quot;</span>
          </div>

          <p className="mx-auto max-w-4xl font-serif text-2xl text-[#E8D5B5] italic leading-normal lg:text-3xl">
            {t('quote')}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-[#C9A87C]/50" />
            <span className="font-bold text-[#8B7355] text-xs uppercase tracking-widest">
              {t('quoteLabel')}
            </span>
            <div className="h-px w-8 bg-[#C9A87C]/50" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
