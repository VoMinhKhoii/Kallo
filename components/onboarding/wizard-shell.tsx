'use client';

import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';
import { saveOnboardingScreen } from '@/lib/onboarding/actions';
import { WIZARD_DEFAULTS } from '@/lib/onboarding/constants';
import type { RegionalProfile } from '@/lib/onboarding/types';
import { ScreenBodyMetrics, type ScreenOneData } from './screen-body-metrics';
import { ScreenCooking } from './screen-cooking';
import { ScreenPortions } from './screen-portions';
import { ScreenRegional } from './screen-regional';
import { StepIndicator } from './step-indicator';

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>;

interface WizardShellProps {
  initialStep: number;
  initialProfile: ProfileRow | null;
  onClose?: () => void;
  onComplete?: () => void;
}

const TOTAL_STEPS = 4;

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
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const [screenData, setScreenData] = useState<
    Record<number, Record<string, unknown>>
  >({});

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

  const handleBack = () => {
    setDirection(-1);
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    startTransition(async () => {
      await saveOnboardingScreen(3, {
        handSpanCm: null,
        knuckleDepthCm: null,
      });
      setCurrentStep(4);
    });
  };

  const screenOneDefaults = buildScreenOneDefaults(initialProfile);

  const screenTwoDefaults = {
    regionalProfile:
      (initialProfile?.regionalProfile as RegionalProfile) ?? null,
  };

  const screenThreeDefaults = {
    handSpanCm: initialProfile?.handSpanCm
      ? Number(initialProfile.handSpanCm)
      : null,
    knuckleDepthCm: initialProfile?.knuckleDepthCm
      ? Number(initialProfile.knuckleDepthCm)
      : null,
  };

  const screenFourDefaults = {
    oilUsage:
      (initialProfile?.oilUsage as 'minimal' | 'normal' | 'heavy') ?? undefined,
    defaultRicePortion:
      (initialProfile?.defaultRicePortion as 'small' | 'medium' | 'large') ??
      undefined,
    sugarBraised:
      (initialProfile?.sugarBraised as 'low' | 'medium' | 'high') ?? undefined,
    defaultProteinPortion:
      (initialProfile?.defaultProteinPortion as 'small' | 'medium' | 'large') ??
      undefined,
    brothConsumption:
      (initialProfile?.brothConsumption as 'leave_it' | 'some' | 'finish_it') ??
      undefined,
  };

  const currentRegionalProfile =
    (screenData[2]?.regionalProfile as RegionalProfile) ??
    screenTwoDefaults.regionalProfile;

  const isNextDisabled =
    isPending ||
    !screenData[currentStep] ||
    (currentStep === 2 && !screenData[2]?.regionalProfile);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C2416]/20 p-4 backdrop-blur-sm sm:p-6"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#FDFCF8] shadow-2xl"
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

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto p-6 sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
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
                <ScreenBodyMetrics
                  defaultValues={screenOneDefaults}
                  onChange={(data: ScreenOneData) =>
                    handleScreenChange(
                      1,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
              {currentStep === 2 && (
                <ScreenRegional
                  defaultValues={screenTwoDefaults}
                  onChange={(data) => handleScreenChange(2, data)}
                />
              )}
              {currentStep === 3 && (
                <ScreenPortions
                  defaultValues={screenThreeDefaults}
                  onChange={(data) =>
                    handleScreenChange(
                      3,
                      data as unknown as Record<string, unknown>
                    )
                  }
                  onSkip={handleSkip}
                />
              )}
              {currentStep === 4 && (
                <ScreenCooking
                  defaultValues={screenFourDefaults}
                  regionalProfile={currentRegionalProfile}
                  onChange={(data) =>
                    handleScreenChange(
                      4,
                      data as unknown as Record<string, unknown>
                    )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation — hidden on step 3 (Portions has its own CTAs) */}
        {currentStep !== 3 && (
          <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/60 border-t bg-[#F5F4F0]/50 px-6 py-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep <= 1 || isPending}
              className={`flex items-center gap-2 font-medium text-[14px] transition-colors ${
                currentStep === 1
                  ? 'pointer-events-none opacity-0'
                  : 'text-[#8B8682] hover:text-[#2C2416]'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex items-center gap-2 rounded-xl bg-[#2C2416] px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm transition-all hover:bg-[#1C1917] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentStep >= TOTAL_STEPS ? 'Finish' : 'Next Step'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
