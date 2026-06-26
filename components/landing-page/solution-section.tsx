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
    <div className="border-[#E8D5B5] border-b-2 border-dashed bg-[#FAF9F7] p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2C2416] text-[#FEFBF6] shadow-lg">
        <span
          className="font-bold text-xl italic"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
        >
          M
        </span>
      </div>
      <h3
        className="mb-1 text-[#2C2416] text-xl uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
      >
        {t('title')}
      </h3>
      <p className="font-mono text-[#8B7355] text-[10px] tracking-wider">
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
    <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-lg border-[#2C2416] border-t-4 bg-white shadow-2xl">
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
              className="relative z-10 text-[#2C2416] text-xl leading-relaxed"
              style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              &quot;Cơm tấm sườn bì chả,{' '}
              <span className="text-[#C9A87C] italic">ít mỡ hành</span>, thêm
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
                    className="flex items-center gap-1.5 rounded-md border border-[#E8D5B5]/50 bg-[#E8D5B5]/20 px-3 py-1.5 font-medium font-mono text-[#2C2416] text-xs"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-[#C9A87C]" />
                    {item}
                  </motion.span>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2 rounded border border-[#E8D5B5] border-dashed bg-[#FAF9F7] p-2 text-[#8B7355] text-[10px]"
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
              className="relative z-10 rounded-xl border border-[#E8D5B5] bg-[#FAF9F7] p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between border-[#E8D5B5]/30 border-b pb-2">
                <span className="font-bold text-[#8B7355] text-xs uppercase tracking-widest">
                  {t('profileTitle')}
                </span>
                <User className="h-4 w-4 text-[#C9A87C]" />
              </div>
              <div className="space-y-3 text-[#6B5D4F] text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('regionPref')}</span>
                  <span className="rounded border border-[#E8D5B5]/30 bg-white px-2 py-0.5 font-bold text-[#2C2416]">
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
                  <div className="flex items-center gap-1 rounded border border-[#C9A87C]/20 bg-[#C9A87C]/10 px-2 py-0.5 font-bold text-[#2C2416]">
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
              className="relative z-10 mt-2 border-[#2C2416] border-t-2 border-dashed pt-5"
            >
              <div className="mb-2 flex flex-col items-end">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[#2C2416] text-lg opacity-60"
                    style={{
                      fontFamily: 'var(--font-lora), Georgia, serif',
                    }}
                  >
                    {t('total')}
                  </span>
                  <span className="font-bold font-mono text-4xl text-[#2C2416]">
                    845
                  </span>
                  <span className="font-medium text-[#8B7355] text-sm">
                    kcal
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 font-medium text-[#C9A87C] text-[10px]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#C9A87C]" />
                  {t('upperBoundNote')}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['P: 30g', 'C: 105g', 'F: 32g'].map((macro, i) => (
                  <div
                    key={i}
                    className="rounded border border-[#E8D5B5]/50 bg-[#FAF9F7] p-2 text-center"
                  >
                    <span className="font-bold font-mono text-[#6B5D4F] text-xs">
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
      className="relative bg-[#FAF9F7] text-[#2C2416]"
    >
      {/* Desktop Scroll-Driven Layout */}
      <div className="relative mx-auto hidden min-h-[300vh] max-w-[1400px] lg:grid lg:grid-cols-12">
        {/* Sticky Visual Column */}
        <div className="sticky top-0 col-span-7 flex h-screen items-center justify-center overflow-hidden border-[#E8D5B5]/30 border-r bg-[#FEFBF6]">
          <div className="absolute inset-0">
            <div className="dashed-line absolute top-0 left-10 h-full w-px bg-[#E8D5B5]/20" />
            <div className="dashed-line absolute top-0 right-10 h-full w-px bg-[#E8D5B5]/20" />
            <div className="absolute -right-20 -bottom-20 h-[400px] w-[400px] rounded-full bg-[#E8D5B5]/10 blur-[80px]" />
          </div>
          <ReceiptVisual stage={currentStage} />
        </div>

        {/* Scrollable Text Column */}
        <div className="relative z-10 col-span-5">
          {/* Section 1 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
              {t('step1Label')}
            </span>
            <h2
              className="mb-6 text-5xl leading-tight"
              style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              {t('step1Title')}
            </h2>
            <p
              className="font-light text-[#6B5D4F] text-lg leading-relaxed"
              style={{
                fontFamily:
                  'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {t('step1Text')}
            </p>
          </div>

          {/* Section 2 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
              {t('step2Label')}
            </span>
            <h2
              className="mb-6 text-5xl leading-tight"
              style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              {t('step2Title')}
            </h2>
            <p
              className="font-light text-[#6B5D4F] text-lg leading-relaxed"
              style={{
                fontFamily:
                  'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {t('step2Text')}
            </p>
          </div>

          {/* Section 3 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
              {t('step3Label')}
            </span>
            <h2
              className="mb-6 text-5xl leading-tight"
              style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              {t('step3Title')}
            </h2>
            <p
              className="font-light text-[#6B5D4F] text-lg leading-relaxed"
              style={{
                fontFamily:
                  'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {t('step3Text')}
            </p>
          </div>

          {/* Section 4 */}
          <div className="flex h-screen flex-col justify-center px-10">
            <span className="mb-4 font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
              {t('step4Label')}
            </span>
            <h2
              className="mb-6 text-5xl leading-tight"
              style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              {t('step4Title')}
            </h2>
            <p
              className="mb-8 font-light text-[#6B5D4F] text-lg leading-relaxed"
              style={{
                fontFamily:
                  'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {t('step4Text')}
            </p>
            <button
              type="button"
              className="group flex w-fit items-center gap-2 bg-[#2C2416] px-8 py-4 font-mono text-[#FEFBF6] text-sm uppercase tracking-wider transition-all duration-300 hover:bg-[#4A3F30]"
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
        <div className="border-[#E8D5B5]/30 border-b px-6 py-14">
          <span className="mb-4 block font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
            {t('step1Label')}
          </span>
          <h2
            className="mb-4 text-4xl text-[#2C2416] leading-tight"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('step1Title')}
          </h2>
          <p
            className="mb-8 font-light text-[#6B5D4F] leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('step1TextMobile')}
          </p>
          <ReceiptVisual stage={1} />
        </div>

        {/* Stage 2 */}
        <div className="border-[#E8D5B5]/30 border-b bg-[#FFFDF9] px-6 py-14">
          <span className="mb-4 block font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
            {t('step2Label')}
          </span>
          <h2
            className="mb-4 text-4xl text-[#2C2416] leading-tight"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('step2Title')}
          </h2>
          <p
            className="mb-8 font-light text-[#6B5D4F] leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('step2TextMobile')}
          </p>
          <ReceiptVisual stage={2} />
        </div>

        {/* Stage 3 */}
        <div className="border-[#E8D5B5]/30 border-b px-6 py-14">
          <span className="mb-4 block font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
            {t('step3Label')}
          </span>
          <h2
            className="mb-4 text-4xl text-[#2C2416] leading-tight"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('step3Title')}
          </h2>
          <p
            className="mb-8 font-light text-[#6B5D4F] leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('step3TextMobile')}
          </p>
          <ReceiptVisual stage={3} />
        </div>

        {/* Stage 4 */}
        <div className="bg-[#FFFDF9] px-6 py-14">
          <span className="mb-4 block font-mono text-[#C9A87C] text-xs uppercase tracking-widest">
            {t('step4Label')}
          </span>
          <h2
            className="mb-4 text-4xl text-[#2C2416] leading-tight"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('step4Title')}
          </h2>
          <p
            className="mb-8 font-light text-[#6B5D4F] leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('step4TextMobile')}
          </p>
          <ReceiptVisual stage={4} />
          <div className="mt-10 text-center">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 bg-[#2C2416] px-8 py-4 font-mono text-[#FEFBF6] text-sm uppercase tracking-wider transition-all duration-300 hover:bg-[#4A3F30]"
            >
              {t('cta')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlights — Why Nhẩm */}
      <div className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 block font-medium text-[#8B7355] text-sm uppercase tracking-widest">
            {t('whyLabel')}
          </span>
          <h2
            className="mb-6 font-normal text-4xl text-[#2C2416] lg:text-5xl"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
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
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#E8D5B5]/20">
                <BookOpen className="h-5 w-5 text-[#8B7355]" />
              </div>
              <div>
                <h3
                  className="mb-2 font-medium text-[#2C2416] text-xl"
                  style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
                >
                  {t('feature1Title')}
                </h3>
                <p
                  className="text-[#6B5D4F] leading-relaxed"
                  style={{
                    fontFamily:
                      'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                  }}
                >
                  {t('feature1Text')}
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#E8D5B5]/20">
                <Sparkles className="h-5 w-5 text-[#8B7355]" />
              </div>
              <div>
                <h3
                  className="mb-2 font-medium text-[#2C2416] text-xl"
                  style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
                >
                  {t('feature2Title')}
                </h3>
                <p
                  className="text-[#6B5D4F] leading-relaxed"
                  style={{
                    fontFamily:
                      'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                  }}
                >
                  {t('feature2Text')}
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#E8D5B5]/20">
                <Scale className="h-5 w-5 text-[#8B7355]" />
              </div>
              <div>
                <h3
                  className="mb-2 font-medium text-[#2C2416] text-xl"
                  style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
                >
                  {t('feature3Title')}
                </h3>
                <p
                  className="text-[#6B5D4F] leading-relaxed"
                  style={{
                    fontFamily:
                      'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                  }}
                >
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
            className="overflow-hidden rounded-2xl border border-[#E8D5B5]/40 bg-white shadow-[#C9A87C]/10 shadow-xl"
          >
            <div className="flex items-center justify-between border-[#E8D5B5]/30 border-b bg-[#F9F6F1] px-6 py-4">
              <span className="font-medium text-[#8B7355] text-sm">
                {t('profile.title')}
              </span>
              <span className="rounded bg-[#E8D5B5]/20 px-2 py-1 text-[#C9A87C] text-xs">
                {t('profile.active')}
              </span>
            </div>

            <div className="space-y-6 p-8">
              <div className="flex items-center justify-between border-[#E8D5B5]/20 border-b pb-4">
                <span className="text-[#6B5D4F]">
                  {t('profile.regionTaste')}
                </span>
                <span className="font-medium text-[#2C2416]">
                  {t('profile.regionTasteValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-[#E8D5B5]/20 border-b pb-4">
                <span className="text-[#6B5D4F]">
                  {t('profile.braisedDishes')}
                </span>
                <span className="font-medium text-[#2C2416]">
                  {t('profile.braisedDishesValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-[#E8D5B5]/20 border-b pb-4">
                <span className="text-[#6B5D4F]">
                  {t('profile.chickenSkin')}
                </span>
                <span className="font-medium text-[#2C2416]">
                  {t('profile.chickenSkinValue')}
                </span>
              </div>
              <div className="flex items-center justify-between border-[#E8D5B5]/20 border-b pb-4">
                <span className="text-[#6B5D4F]">
                  {t('profile.ricePortion')}
                </span>
                <span className="font-medium text-[#2C2416]">
                  {t('profile.ricePortionValue')}
                </span>
              </div>

              <div className="mt-6 rounded-xl border border-[#E8D5B5]/30 bg-[#FEFBF6] p-4">
                <p className="text-[#8B7355] text-sm italic">
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
