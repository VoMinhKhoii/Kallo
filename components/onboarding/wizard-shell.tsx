'use client';

import { ArrowLeft, ArrowRight, Loader2, SkipForward, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';
import { saveOnboardingScreen } from '@/lib/onboarding/actions';
import { WIZARD_DEFAULTS } from '@/lib/onboarding/constants';
import { ScreenBodyMetrics, type ScreenOneData } from './screen-body-metrics';
import { ScreenCooking } from './screen-cooking';
import { ScreenOrigin } from './screen-origin';
import { StepIndicator } from './step-indicator';

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>;

interface WizardShellProps {
  initialStep: number;
  initialProfile: ProfileRow | null;
  onClose?: () => void;
  onComplete?: () => void;
}

const TOTAL_STEPS = 3;

function parseAggression(
  raw: string | null | undefined,
  fallback: number
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

function buildScreenOneDefaults(profile: ProfileRow | null) {
  return {
    biologicalSex: (profile?.biologicalSex as 'male' | 'female') ?? undefined,
    weightKg: profile?.weightKg ? Number(profile.weightKg) : undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: profile?.age ?? undefined,
    activityLevel:
      (profile?.activityLevel as
        | 'sedentary'
        | 'light'
        | 'moderate'
        | 'very_active') ?? WIZARD_DEFAULTS.activityLevel,
    goal:
      (profile?.goal as 'cutting' | 'bulking' | 'maintaining') ??
      WIZARD_DEFAULTS.goal,
    aggression: parseAggression(
      profile?.aggression,
      WIZARD_DEFAULTS.aggression
    ),
    carbSplit:
      (profile?.carbSplit as 'moderate_carb' | 'lower_carb' | 'higher_carb') ??
      WIZARD_DEFAULTS.carbSplit,
    deficitOverride: WIZARD_DEFAULTS.deficitOverride,
  };
}

export function WizardShell({
  initialStep,
  initialProfile,
  onClose,
  onComplete,
}: WizardShellProps) {
  const router = useRouter();
  const t = useTranslations('common');
  const tOnboarding = useTranslations('onboarding');
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const [screenData, setScreenData] = useState<
    Record<number, Record<string, unknown>>
  >({});
  const modalMaxWidthClass =
    currentStep === 1
      ? 'max-w-4xl'
      : currentStep === 2
        ? 'max-w-6xl'
        : 'max-w-[58rem]';

  // Scroll affordance: fade gradient when content overflows
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollGradient, setShowScrollGradient] = useState(false);

  const updateScrollGradient = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const hasMoreToScroll =
      el.scrollHeight > el.clientHeight &&
      el.scrollTop + el.clientHeight < el.scrollHeight - 10;
    setShowScrollGradient(hasMoreToScroll);
  }, []);

  useEffect(() => {
    updateScrollGradient();
    const el = contentRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollGradient, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollGradient);
  }, [updateScrollGradient]);

  // Re-check gradient when step changes (new screen may have different height)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check after screen transition
  useEffect(() => {
    const timer = setTimeout(updateScrollGradient, 150);
    return () => clearTimeout(timer);
  }, [currentStep, updateScrollGradient]);

  const handleScreenChange = useCallback(
    (step: number, data: Record<string, unknown>) => {
      setScreenData((prev) => ({ ...prev, [step]: data }));
    },
    []
  );

  const finishWizard = () => {
    if (onComplete) {
      onComplete();
    } else {
      router.push('/logging');
    }
  };

  const handleNext = () => {
    setDirection(1);
    const data = screenData[currentStep];
    if (!data) return;

    startTransition(async () => {
      await saveOnboardingScreen(currentStep, data);
      if (currentStep >= TOTAL_STEPS) {
        finishWizard();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    });
  };

  const handleSkip = () => {
    setDirection(1);
    startTransition(async () => {
      await saveOnboardingScreen(currentStep, {});
      if (currentStep >= TOTAL_STEPS) {
        finishWizard();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    });
  };

  const handleBack = () => {
    setDirection(-1);
    setCurrentStep((prev) => prev - 1);
  };

  // Merge in-memory screenData (from previous edits) with DB defaults.
  // This preserves typed inputs when navigating back.
  const screenOneDefaults = screenData[1]
    ? {
        countryOfOrigin:
          (screenData[1].countryOfOrigin as string | null) ?? null,
        countryOfResidence:
          (screenData[1].countryOfResidence as string | null) ?? null,
        preferredLocale: (screenData[1].preferredLocale as string) ?? 'en',
      }
    : {
        countryOfOrigin: initialProfile?.countryOfOrigin ?? null,
        countryOfResidence: initialProfile?.countryOfResidence ?? null,
        preferredLocale: initialProfile?.preferredLocale ?? 'en',
      };

  const screenTwoDefaults = screenData[2]
    ? {
        ...buildScreenOneDefaults(initialProfile),
        ...(screenData[2] as Partial<ScreenOneData>),
      }
    : buildScreenOneDefaults(initialProfile);

  const screenThreeDefaults = screenData[3]
    ? {
        oilUsage:
          (screenData[3].oilUsage as 'minimal' | 'normal' | 'heavy') ??
          undefined,
        defaultRicePortion:
          (screenData[3].defaultRicePortion as 'small' | 'medium' | 'large') ??
          undefined,
        sugarBraised:
          (screenData[3].sugarBraised as 'low' | 'medium' | 'high') ??
          undefined,
        defaultProteinPortion:
          (screenData[3].defaultProteinPortion as
            | 'small'
            | 'medium'
            | 'large') ?? undefined,
        brothConsumption:
          (screenData[3].brothConsumption as
            | 'leave_it'
            | 'some'
            | 'finish_it') ?? undefined,
      }
    : {
        oilUsage:
          (initialProfile?.oilUsage as 'minimal' | 'normal' | 'heavy') ??
          undefined,
        defaultRicePortion:
          (initialProfile?.defaultRicePortion as
            | 'small'
            | 'medium'
            | 'large') ?? undefined,
        sugarBraised:
          (initialProfile?.sugarBraised as 'low' | 'medium' | 'high') ??
          undefined,
        defaultProteinPortion:
          (initialProfile?.defaultProteinPortion as
            | 'small'
            | 'medium'
            | 'large') ?? undefined,
        brothConsumption:
          (initialProfile?.brothConsumption as
            | 'leave_it'
            | 'some'
            | 'finish_it') ?? undefined,
      };

  const isNextDisabled = isPending || !screenData[currentStep];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C2416]/20 p-4 backdrop-blur-sm sm:p-6"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        role="dialog"
        aria-label={tOnboarding('stepOf', {
          current: currentStep,
          total: TOTAL_STEPS,
        })}
        aria-modal="true"
        className={`flex max-h-[92dvh] w-full ${modalMaxWidthClass} flex-col overflow-hidden rounded-[28px] bg-[#FDFCF8] shadow-2xl`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/60 border-b px-6 py-4">
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-full p-2 text-[#8B8682] transition-colors hover:bg-[#EAE7E0]/50 hover:text-[#2C2416]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content with scroll affordance */}
        <div
          ref={contentRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-6 lg:p-7"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
              className="min-h-full"
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 40,
              }}
            >
              {currentStep === 1 && (
                <ScreenOrigin
                  defaultValues={screenOneDefaults}
                  onChange={(data) =>
                    handleScreenChange(
                      1,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
              {currentStep === 2 && (
                <ScreenBodyMetrics
                  defaultValues={screenTwoDefaults}
                  onChange={(data: ScreenOneData) =>
                    handleScreenChange(
                      2,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
              {currentStep === 3 && (
                <ScreenCooking
                  defaultValues={screenThreeDefaults}
                  onChange={(data) =>
                    handleScreenChange(
                      3,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom fade gradient — hints more content below */}
          {showScrollGradient && (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-12 bg-gradient-to-t from-[#FDFCF8] to-transparent" />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/60 border-t bg-[#F5F4F0]/50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep <= 1 || isPending}
            className={`flex touch-manipulation items-center gap-2 font-medium text-[14px] transition-colors ${
              currentStep === 1
                ? 'pointer-events-none opacity-0'
                : 'text-[#8B8682] hover:text-[#2C2416]'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isPending}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl px-4 py-2.5 font-medium text-[#8B8682] text-[14px] transition-colors hover:bg-[#EAE7E0]/50 hover:text-[#2C2416] disabled:opacity-50"
            >
              {t('skip')}
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex touch-manipulation items-center gap-2 rounded-xl bg-[#2C2416] px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm transition-all hover:bg-[#1C1917] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentStep >= TOTAL_STEPS ? t('finish') : t('next')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
