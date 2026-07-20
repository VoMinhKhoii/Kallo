'use client';

import {
  ArrowRight,
  BookOpen,
  Database,
  Scale,
  Sparkles,
  User,
} from 'lucide-react';
import { AnimatePresence, motion, useScroll } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

// --- Sub-components for the Visualization ---

function ReceiptHeader() {
  const t = useTranslations('landing.solution.receipt');
  return (
    <div className="border-nham-border border-b-2 border-dashed bg-[#FAF9F7] p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-nham-ink text-nham-surface shadow-lg">
        <span className="font-bold font-serif text-xl italic">M</span>
      </div>
      <h3 className="mb-1 font-serif text-nham-text text-xl uppercase tracking-widest">
        {t('title')}
      </h3>
      <p className="font-mono text-[10px] text-nham-text-muted tracking-wider">
        ID: #8392-VN • SAIGON • {new Date().toLocaleDateString('en-US')}
      </p>
    </div>
  );
}

function ReceiptFooter() {
  return (
    <div className="h-4 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDEyIDEyIiBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSI2IiBjeT0iNiIgcj0iMSIgZmlsbD0iI0U4RDVCNSIvPjwvc3ZnPg==')] bg-repeat-x opacity-50" />
  );
}

const ReceiptVisual = ({ stage }: { stage: number }) => {
  const t = useTranslations('landing.solution.receipt');
  return (
    <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-lg border-nham-ink border-t-4 bg-white shadow-2xl">
      <ReceiptHeader />

      <div className="relative min-h-[420px] space-y-6 bg-[#FFFDF9] p-6">
        {/* Background Texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          }}
        />

        <AnimatePresence mode="wait">
          {/* Stage 1: Raw Input */}
          {stage === 1 && (
            <motion.div
              key="stage1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative z-10 font-serif text-nham-text text-xl leading-relaxed"
            >
              &quot;Cơm tấm sườn bì chả,{' '}
              <span className="text-nham-accent italic">ít mỡ hành</span>, thêm
              chén canh chua.&quot;
            </motion.div>
          )}

          {/* Stage 2: Extraction */}
          {stage === 2 && (
            <motion.div
              key="stage2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                {[
                  'Gạo tấm (raw)',
                  'Sườn heo (raw)',
                  'Da heo (raw)',
                  'Trứng gà (raw)',
                  'Canh chua (raw)',
                ].map((item, i) => (
                  <motion.span
                    key={item}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-1.5 rounded-md border border-nham-border/50 bg-nham-border/20 px-3 py-1.5 font-medium font-mono text-nham-text text-xs"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-nham-accent" />
                    {item}
                  </motion.span>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2 rounded border border-nham-border border-dashed bg-[#FAF9F7] p-2 text-[10px] text-nham-text-muted"
              >
                <Database className="h-3 w-3 animate-pulse" />
                <span className="font-mono uppercase tracking-wide">
                  {t('dbQuery')}
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* Stage 3: Context */}
          {stage === 3 && (
            <motion.div
              key="stage3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 rounded-xl border border-nham-border bg-[#FAF9F7] p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between border-nham-border/30 border-b pb-2">
                <span className="font-bold text-nham-text-muted text-xs uppercase tracking-widest">
                  {t('profileTitle')}
                </span>
                <User className="h-4 w-4 text-nham-text-muted" />
              </div>
              <div className="space-y-3 text-nham-text-soft text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('regionPref')}</span>
                  <span className="rounded border border-nham-border/30 bg-white px-2 py-0.5 font-bold text-nham-text">
                    {t('regionValue')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('modification')}</span>
                  <span className="rounded border border-nham-danger/30 bg-nham-danger/10 px-2 py-0.5 font-bold text-nham-danger">
                    {t('modificationValue')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('goalStrategy')}</span>
                  <div className="flex items-center gap-1 rounded border border-nham-accent/20 bg-nham-accent/10 px-2 py-0.5 font-bold text-nham-text">
                    <span>{t('goalCutting')}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{t('goalUpperBound')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stage 4: Result */}
          {stage === 4 && (
            <motion.div
              key="stage4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 mt-2 border-nham-ink border-t-2 border-dashed pt-5"
            >
              <div className="mb-2 flex flex-col items-end">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-lg text-nham-text opacity-60">
                    {t('total')}
                  </span>
                  <span className="font-bold font-mono text-4xl text-nham-text">
                    845
                  </span>
                  <span className="font-medium text-nham-text-muted text-sm">
                    kcal
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 font-medium text-[10px] text-nham-text-muted">
                  <div className="h-1.5 w-1.5 rounded-full bg-nham-accent" />
                  {t('upperBoundNote')}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['P: 30g', 'C: 105g', 'F: 32g'].map((macro, i) => (
                  <div
                    key={i}
                    className="rounded border border-nham-border/50 bg-[#FAF9F7] p-2 text-center"
                  >
                    <span className="font-bold font-mono text-nham-text-soft text-xs">
                      {macro}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ReceiptFooter />
    </div>
  );
};

export function SolutionSection() {
  const t = useTranslations('landing.solution');
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStage, setCurrentStage] = useState(1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (latest) => {
      if (latest < 0.25) setCurrentStage(1);
      else if (latest < 0.5) setCurrentStage(2);
      else if (latest < 0.75) setCurrentStage(3);
      else setCurrentStage(4);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <section
      ref={containerRef}
      id="features"
      className="relative bg-[#FAF9F7] text-nham-text"
    >
      {/* Desktop Scroll-Driven Layout */}
      <div className="relative mx-auto hidden min-h-[300vh] max-w-[1400px] lg:grid lg:grid-cols-12">
        {/* Sticky Visual Column */}
        <div className="sticky top-0 col-span-7 flex h-screen items-center justify-center overflow-hidden border-nham-border/30 border-r bg-nham-surface">
          <div className="absolute inset-0">
            <div className="dashed-line absolute top-0 left-10 h-full w-px bg-nham-border/20" />
            <div className="dashed-line absolute top-0 right-10 h-full w-px bg-nham-border/20" />
            <div className="absolute -right-20 -bottom-20 h-[400px] w-[400px] rounded-full bg-nham-border/10 blur-[80px]" />
          </div>
          <ReceiptVisual stage={currentStage} />
        </div>

        {/* Scrollable Text Column */}
        <div className="relative z-10 col-span-5">
          {/* Section 1 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-nham-stone text-xs uppercase tracking-widest">
              {t('step1Label')}
            </span>
            <h2 className="mb-6 font-serif text-5xl leading-tight">
              {t('step1Title')}
            </h2>
            <p className="font-light font-sans-display text-lg text-nham-text-soft leading-relaxed">
              {t('step1Text')}
            </p>
          </div>

          {/* Section 2 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-nham-stone text-xs uppercase tracking-widest">
              {t('step2Label')}
            </span>
            <h2 className="mb-6 font-serif text-5xl leading-tight">
              {t('step2Title')}
            </h2>
            <p className="font-light font-sans-display text-lg text-nham-text-soft leading-relaxed">
              {t('step2Text')}
            </p>
          </div>

          {/* Section 3 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-nham-stone text-xs uppercase tracking-widest">
              {t('step3Label')}
            </span>
            <h2 className="mb-6 font-serif text-5xl leading-tight">
              {t('step3Title')}
            </h2>
            <p className="font-light font-sans-display text-lg text-nham-text-soft leading-relaxed">
              {t('step3Text')}
            </p>
          </div>

          {/* Section 4 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-nham-stone text-xs uppercase tracking-widest">
              {t('step4Label')}
            </span>
            <h2 className="mb-6 font-serif text-5xl leading-tight">
              {t('step4Title')}
            </h2>
            <p className="mb-8 font-light font-sans-display text-lg text-nham-text-soft leading-relaxed">
              {t('step4Text')}
            </p>
            <button
              type="button"
              className="group flex w-fit items-center gap-2 bg-nham-ink px-8 py-4 font-mono text-nham-surface text-sm uppercase tracking-wider transition-all duration-300 hover:bg-nham-ink-hover"
            >
              {t('cta')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="pb-16 lg:hidden">
        {/* Stage 1 */}
        <div className="border-nham-border/30 border-b px-6 py-14">
          <span className="mb-4 block font-mono text-nham-stone text-xs uppercase tracking-widest">
            {t('step1Label')}
          </span>
          <h2 className="mb-4 font-serif text-4xl text-nham-text leading-tight">
            {t('step1Title')}
          </h2>
          <p className="mb-8 font-light font-sans-display text-nham-text-soft leading-relaxed">
            {t('step1TextMobile')}
          </p>
          <ReceiptVisual stage={1} />
        </div>

        {/* Stage 2 */}
        <div className="border-nham-border/30 border-b bg-[#FFFDF9] px-6 py-14">
          <span className="mb-4 block font-mono text-nham-stone text-xs uppercase tracking-widest">
            {t('step2Label')}
          </span>
          <h2 className="mb-4 font-serif text-4xl text-nham-text leading-tight">
            {t('step2Title')}
          </h2>
          <p className="mb-8 font-light font-sans-display text-nham-text-soft leading-relaxed">
            {t('step2TextMobile')}
          </p>
          <ReceiptVisual stage={2} />
        </div>

        {/* Stage 3 */}
        <div className="border-nham-border/30 border-b px-6 py-14">
          <span className="mb-4 block font-mono text-nham-stone text-xs uppercase tracking-widest">
            {t('step3Label')}
          </span>
          <h2 className="mb-4 font-serif text-4xl text-nham-text leading-tight">
            {t('step3Title')}
          </h2>
          <p className="mb-8 font-light font-sans-display text-nham-text-soft leading-relaxed">
            {t('step3TextMobile')}
          </p>
          <ReceiptVisual stage={3} />
        </div>

        {/* Stage 4 */}
        <div className="bg-[#FFFDF9] px-6 py-14">
          <span className="mb-4 block font-mono text-nham-stone text-xs uppercase tracking-widest">
            {t('step4Label')}
          </span>
          <h2 className="mb-4 font-serif text-4xl text-nham-text leading-tight">
            {t('step4Title')}
          </h2>
          <p className="mb-8 font-light font-sans-display text-nham-text-soft leading-relaxed">
            {t('step4TextMobile')}
          </p>
          <ReceiptVisual stage={4} />
          <div className="mt-10 text-center">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 bg-nham-ink px-8 py-4 font-mono text-nham-surface text-sm uppercase tracking-wider transition-all duration-300 hover:bg-nham-ink-hover"
            >
              {t('cta')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlights — Why Kallo */}
      <div className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 block font-medium text-nham-text-muted text-sm uppercase tracking-widest">
            {t('whyLabel')}
          </span>
          <h2 className="mb-6 font-normal font-serif text-4xl text-nham-text lg:text-5xl">
            {t('whyTitle')}
          </h2>
        </motion.div>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-nham-border/20">
                <BookOpen className="h-5 w-5 text-nham-text-muted" />
              </div>
              <div>
                <h3 className="mb-2 font-medium font-serif text-nham-text text-xl">
                  {t('feature1Title')}
                </h3>
                <p className="font-sans-display text-nham-text-soft leading-relaxed">
                  {t('feature1Text')}
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-nham-border/20">
                <Sparkles className="h-5 w-5 text-nham-text-muted" />
              </div>
              <div>
                <h3 className="mb-2 font-medium font-serif text-nham-text text-xl">
                  {t('feature2Title')}
                </h3>
                <p className="font-sans-display text-nham-text-soft leading-relaxed">
                  {t('feature2Text')}
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-nham-border/20">
                <Scale className="h-5 w-5 text-nham-text-muted" />
              </div>
              <div>
                <h3 className="mb-2 font-medium font-serif text-nham-text text-xl">
                  {t('feature3Title')}
                </h3>
                <p className="font-sans-display text-nham-text-soft leading-relaxed">
                  {t('feature3Text')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right: Visual Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl border border-nham-border/40 bg-white shadow-nham-accent/10 shadow-xl"
          >
            <div className="flex items-center justify-between border-nham-border/30 border-b bg-[#F9F6F1] px-6 py-4">
              <span className="font-medium text-nham-text-muted text-sm">
                {t('profile.title')}
              </span>
              <span className="rounded bg-nham-border/20 px-2 py-1 text-nham-text-muted text-xs">
                {t('profile.active')}
              </span>
            </div>

            <div className="space-y-6 p-8">
              <div className="flex items-center justify-between border-nham-border/20 border-b pb-4">
                <span className="text-nham-text-soft">
                  {t('profile.regionTaste')}
                </span>
                <span className="font-medium text-nham-text">
                  {t('profile.regionTasteValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-nham-border/20 border-b pb-4">
                <span className="text-nham-text-soft">
                  {t('profile.braisedDishes')}
                </span>
                <span className="font-medium text-nham-text">
                  {t('profile.braisedDishesValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-nham-border/20 border-b pb-4">
                <span className="text-nham-text-soft">
                  {t('profile.chickenSkin')}
                </span>
                <span className="font-medium text-nham-text">
                  {t('profile.chickenSkinValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-nham-border/20 border-b pb-4">
                <span className="text-nham-text-soft">
                  {t('profile.ricePortion')}
                </span>
                <span className="font-medium text-nham-text">
                  {t('profile.ricePortionValue')}
                </span>
              </div>

              <div className="mt-6 rounded-xl border border-nham-border/30 bg-nham-surface p-4">
                <p className="text-nham-text-muted text-sm italic">
                  {t('profile.disclaimer')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
