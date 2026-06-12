'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { Button } from '@/components/ui/button';
import {
  getHeroFixture,
  HERO_AUTOPLAY_ID,
  HERO_CHIP_IDS,
  type HeroDemoFixture,
} from './hero-demo-fixtures';

type DemoPhase = 'typing' | 'matching' | 'estimating' | 'result';

const TYPING_SPEED_MS = 45;
const MATCH_MS = 700;
const ESTIMATE_MS = 800;

export function Hero() {
  const t = useTranslations('landing.hero');
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, 30]);
  const { openDialog } = useAuthDialog();
  const prefersReducedMotion = useReducedMotion();

  // The meal currently being demonstrated (autoplay starts on the canned one).
  const [fixture, setFixture] = useState<HeroDemoFixture>(() =>
    getHeroFixture(HERO_AUTOPLAY_ID)
  );
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const [typedText, setTypedText] = useState('');
  // Once the canned demo finishes, the input bar becomes a real control.
  const [interactive, setInteractive] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) {
      clearTimeout(id);
    }
    timers.current = [];
  }, []);

  // Drive one analysis: type the meal, run the staged phases, reveal the card.
  // Reduced motion skips straight to the result with no typing or delays.
  const runDemo = useCallback(
    (next: HeroDemoFixture, { autoplay }: { autoplay: boolean }) => {
      clearTimers();
      setFixture(next);

      if (prefersReducedMotion) {
        setTypedText(next.text);
        setPhase('result');
        if (autoplay) {
          setInteractive(true);
        }
        return;
      }

      setTypedText('');
      setPhase('typing');

      let index = 0;
      const typeNext = () => {
        index += 1;
        setTypedText(next.text.slice(0, index));
        if (index < next.text.length) {
          timers.current.push(setTimeout(typeNext, TYPING_SPEED_MS));
        } else {
          timers.current.push(
            setTimeout(() => setPhase('matching'), 300),
            setTimeout(() => setPhase('estimating'), 300 + MATCH_MS),
            setTimeout(
              () => {
                setPhase('result');
                if (autoplay) {
                  setInteractive(true);
                }
              },
              300 + MATCH_MS + ESTIMATE_MS
            )
          );
        }
      };
      timers.current.push(setTimeout(typeNext, 400));
    },
    [clearTimers, prefersReducedMotion]
  );

  // Autoplay once on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run exactly once
  useEffect(() => {
    runDemo(getHeroFixture(HERO_AUTOPLAY_ID), { autoplay: true });
    return clearTimers;
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      setInputValue('');
      runDemo(
        {
          id: 'custom',
          text: trimmed,
          rows: fixture.rows,
          total: fixture.total,
        },
        { autoplay: false }
      );
    },
    [fixture.rows, fixture.total, runDemo]
  );

  const selectChip = useCallback(
    (id: string) => {
      setInputValue('');
      runDemo(getHeroFixture(id), { autoplay: false });
    },
    [runDemo]
  );

  const isAnalyzing = phase === 'matching' || phase === 'estimating';
  const showResult = phase === 'result';

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-[#FEFBF6] pt-24 pb-12 lg:pt-32 lg:pb-20">
      {/* Refined Background Decor */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#E8D5B5]/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#C9A87C]/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-12 px-6 lg:grid-cols-5 lg:gap-20">
        {/* Left Column: Text (2 columns) */}
        <div className="relative z-20 text-left lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#E8D5B5] bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#C9A87C]" />
            <span className="font-semibold text-[#8B7355] text-xs uppercase tracking-widest">
              {t('badge')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-8 font-normal text-5xl text-[#2C2416] leading-[1.1] lg:text-7xl"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('title')} <br />
            <span className="font-light text-[#C9A87C] italic">
              {t('titleHighlight')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-10 max-w-md font-light text-[#6B5D4F] text-lg leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Button
              variant="hero-dark"
              size="hero"
              className="group"
              onClick={() => openDialog('sign-up')}
            >
              <span className="font-medium tracking-wide">{t('cta')}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              variant="hero-outline"
              size="hero"
              onClick={() => scrollToAnchorId('how')}
            >
              {t('ctaSecondary')}
            </Button>
          </motion.div>

          {/* Honest beta note — no fabricated avatars or "loved by N users"
              claims for a product that is just launching. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="mt-12 text-[#8B7355] text-sm"
          >
            <p className="font-medium">{t('beta')}</p>
          </motion.div>
        </div>

        {/* Right Column: Interactive Demo (3 columns) */}
        <motion.div
          style={{ y }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative flex items-center justify-center lg:col-span-3"
        >
          {/* Phone + Badge Wrapper */}
          <div className="relative mx-auto w-full max-w-[380px] sm:max-w-[400px]">
            {/* Phone/App Container */}
            <div className="relative h-[620px] w-full overflow-hidden rounded-[3rem] border-[8px] border-white bg-white shadow-[0_30px_60px_-15px_rgba(201,168,124,0.25)] ring-1 ring-[#E8D5B5]/50 sm:h-[650px] lg:h-[680px]">
              {/* Status Bar */}
              <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between bg-white/90 px-6 backdrop-blur-md">
                <div className="font-semibold text-[#2C2416] text-xs tracking-wider">
                  9:41
                </div>
                <div className="flex gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-[#2C2416]" />
                  <div className="h-4 w-4 rounded-full border border-[#2C2416]" />
                </div>
              </div>

              {/* Main App Content */}
              <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#FAF9F7] px-5 pt-16 pb-24">
                {/* Date Header */}
                <div className="text-center">
                  <p className="mb-1 font-medium text-[#8B7355] text-xs uppercase tracking-widest">
                    {t('demo.today')}
                  </p>
                  <h3 className="font-serif text-[#2C2416] text-xl sm:text-2xl">
                    {t('demo.date')}
                  </h3>
                </div>

                {/* Chat Stream */}
                <div className="flex min-h-0 flex-1 flex-col justify-end space-y-3 overflow-y-auto">
                  {/* User Input Bubble */}
                  <div className="max-w-[82%] self-end">
                    <div className="rounded-3xl rounded-br-sm border border-[#E8D5B5]/20 bg-[#E8D5B5]/20 px-4 py-3 text-[#2C2416] shadow-sm">
                      <p className="break-words font-normal font-serif text-sm leading-relaxed sm:text-[15px]">
                        {typedText}
                        {phase === 'typing' && (
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#C9A87C] align-middle" />
                        )}
                      </p>
                    </div>
                    <p className="mt-1.5 mr-1 text-right text-[#8B7355] text-[10px] opacity-60">
                      {t('demo.justNow')}
                    </p>
                  </div>

                  {/* Staged loading copy */}
                  <AnimatePresence mode="wait">
                    {isAnalyzing && (
                      <motion.div
                        key={phase}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2 self-start text-[#8B7355] text-xs"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416]">
                          <Sparkles className="h-2.5 w-2.5 animate-pulse text-[#C9A87C]" />
                        </span>
                        <span className="font-medium">
                          {phase === 'matching'
                            ? t('demo.phaseMatching')
                            : t('demo.phaseEstimating')}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AI Response Card */}
                  {showResult && (
                    <motion.div
                      key={fixture.id + fixture.text}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { opacity: 0, y: 20, scale: 0.95 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="w-full max-w-full"
                    >
                      <div className="rounded-2xl rounded-bl-sm border border-[#E8D5B5]/30 bg-white p-3 shadow-[#C9A87C]/5 shadow-lg sm:p-4">
                        <div className="mb-2 flex items-center justify-between border-[#F0EAE0] border-b pb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416]">
                              <Sparkles className="h-2.5 w-2.5 text-[#C9A87C]" />
                            </div>
                            <span className="font-bold text-[#2C2416] text-[9px] uppercase tracking-wide sm:text-[10px]">
                              {t('demo.analysis')}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2">
                          {fixture.rows.map((item, idx) => (
                            <motion.div
                              initial={
                                prefersReducedMotion
                                  ? { opacity: 1 }
                                  : { opacity: 0, x: -10 }
                              }
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.08 }}
                              key={item.name}
                              className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
                            >
                              <span className="truncate text-[#6B5D4F]">
                                {item.name}
                              </span>
                              <span className="shrink-0 font-mono font-semibold text-[#2C2416] text-xs">
                                {item.cal}
                              </span>
                            </motion.div>
                          ))}

                          <div className="mt-1 flex items-center justify-between border-[#F0EAE0] border-t pt-2">
                            <span className="font-normal font-serif text-[#2C2416] text-xs sm:text-sm">
                              {t('demo.totalCalories')}
                            </span>
                            <span className="font-bold font-mono text-[#C9A87C] text-base sm:text-lg">
                              {fixture.total}
                            </span>
                          </div>

                          {/* Conversion gate: saving the meal needs an account. */}
                          <button
                            type="button"
                            onClick={() => openDialog('sign-up')}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2C2416] py-2 font-medium text-[11px] text-white transition-transform active:scale-[0.98] sm:text-xs"
                          >
                            {t('demo.save')}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Input Bar — real once the canned demo finishes */}
              <div className="absolute right-4 bottom-5 left-4 z-20 sm:right-5 sm:bottom-6 sm:left-5">
                {interactive && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {HERO_CHIP_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectChip(id)}
                        disabled={isAnalyzing || phase === 'typing'}
                        className="rounded-full border border-[#E8D5B5]/60 bg-white/90 px-2.5 py-1 font-medium text-[#8B7355] text-[10px] shadow-sm backdrop-blur-sm transition-colors hover:border-[#C9A87C] hover:text-[#2C2416] disabled:opacity-50 sm:text-[11px]"
                      >
                        {t(`demo.chips.${id}`)}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitText(inputValue);
                  }}
                  className="flex h-12 items-center justify-between rounded-full border border-[#E8D5B5]/30 bg-white px-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:h-14 sm:pl-5"
                >
                  <input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={!interactive || isAnalyzing || phase === 'typing'}
                    placeholder={t('demo.inputPlaceholder')}
                    aria-label={t('demo.inputPlaceholder')}
                    className="min-w-0 flex-1 bg-transparent text-[#2C2416] text-sm outline-none placeholder:text-[#B0A695] disabled:cursor-default sm:text-base"
                  />
                  <button
                    type="submit"
                    disabled={!interactive || isAnalyzing || phase === 'typing'}
                    aria-label={t('demo.send')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C2416] shadow-lg transition-transform active:scale-95 disabled:opacity-50 sm:h-10 sm:w-10"
                  >
                    <ArrowRight className="h-4 w-4 text-white" />
                  </button>
                </form>
              </div>

              {/* Gradient Overlay for Bottom Fade */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#FAF9F7] to-transparent" />
            </div>

            {/* Floating Context Badge - Beside the message bubble */}
            {showResult && (
              <motion.div
                initial={
                  prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }
                }
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-[38%] left-[calc(100%+1rem)] z-30 hidden w-[170px] -translate-y-1/2 rounded-2xl border border-[#E8D5B5]/40 bg-white/95 p-3 shadow-xl backdrop-blur-md xl:block"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="font-bold text-[#8B7355] text-[9px] uppercase tracking-wider">
                    {t('demo.smartContext')}
                  </span>
                </div>
                <p className="font-medium text-[#2C2416] text-[10px] leading-relaxed">
                  {t('demo.smartContextText')}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
