'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
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
}

const TOTAL_STEPS = 4;

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
    aggression:
      (profile?.aggression as 'gentle' | 'moderate' | 'aggressive' | null) ??
      WIZARD_DEFAULTS.aggression,
    carbSplit:
      (profile?.carbSplit as 'moderate_carb' | 'lower_carb' | 'higher_carb') ??
      WIZARD_DEFAULTS.carbSplit,
    deficitOverride: WIZARD_DEFAULTS.deficitOverride,
  };
}

export function WizardShell({ initialStep, initialProfile }: WizardShellProps) {
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

  const handleNext = () => {
    setDirection(1);
    const data = screenData[currentStep];
    if (!data) return;

    startTransition(async () => {
      await saveOnboardingScreen(currentStep, data);
      if (currentStep >= TOTAL_STEPS) {
        router.push('/logging');
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
      await saveOnboardingScreen(4, {
        handSpanCm: null,
        knuckleDepthCm: null,
        bowlSizeMl: WIZARD_DEFAULTS.bowlSizeMl,
        plateSizeMl: WIZARD_DEFAULTS.plateSizeMl,
      });
      router.push('/logging');
    });
  };

  const screenOneDefaults = buildScreenOneDefaults(initialProfile);

  const screenTwoDefaults = {
    regionalProfile:
      (initialProfile?.regionalProfile as RegionalProfile) ?? null,
  };

  const screenThreeDefaults = {
    oilUsage:
      (initialProfile?.oilUsage as 'minimal' | 'normal' | 'heavy') ?? undefined,
    fatTrim:
      (initialProfile?.fatTrimPork as 'trim' | 'eat_all' | 'by_dish') ??
      undefined,
    boneAwareness: initialProfile?.boneAwareness ?? undefined,
    defaultRicePortion:
      (initialProfile?.defaultRicePortion as 'small' | 'medium' | 'large') ??
      undefined,
    sugarBraised:
      (initialProfile?.sugarBraised as 'low' | 'medium' | 'high') ?? undefined,
  };

  const screenFourDefaults = {
    handSpanCm: initialProfile?.handSpanCm
      ? Number(initialProfile.handSpanCm)
      : null,
    knuckleDepthCm: initialProfile?.knuckleDepthCm
      ? Number(initialProfile.knuckleDepthCm)
      : null,
    bowlSizeMl: initialProfile?.bowlSizeMl ?? WIZARD_DEFAULTS.bowlSizeMl,
    plateSizeMl: initialProfile?.plateSizeMl ?? WIZARD_DEFAULTS.plateSizeMl,
  };

  // Get regional profile from screenData (step 2) or initial profile
  const currentRegionalProfile =
    (screenData[2]?.regionalProfile as RegionalProfile) ??
    screenTwoDefaults.regionalProfile;

  // Step 2 next disabled if no regional profile selected
  const isNextDisabled =
    isPending ||
    !screenData[currentStep] ||
    (currentStep === 2 && !screenData[2]?.regionalProfile);

  return (
    <div>
      <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {/* Screen content */}
      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{
              duration: 0.25,
              ease: 'easeInOut',
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
              <ScreenCooking
                defaultValues={screenThreeDefaults}
                regionalProfile={currentRegionalProfile}
                onChange={(data) =>
                  handleScreenChange(
                    3,
                    data as unknown as Record<string, unknown>
                  )
                }
              />
            )}
            {currentStep === 4 && (
              <ScreenPortions
                defaultValues={screenFourDefaults}
                onChange={(data) =>
                  handleScreenChange(
                    4,
                    data as unknown as Record<string, unknown>
                  )
                }
                onSkip={handleSkip}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation — sticky to bottom of scroll container */}
      <div
        className="sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center justify-between gap-y-3 border-[#E8D5B5]/30 border-t bg-[#FEFBF6] px-6 py-4 shadow-[0_-8px_20px_-6px_rgba(44,36,22,0.06)]"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep <= 1 || isPending}
          className="border-[#E8D5B5] text-[#2C2416] hover:bg-[#E8D5B5]/20"
        >
          Quay lại
        </Button>
        {currentStep === 4 ? (
          <div className="order-first flex w-full gap-2 sm:order-none sm:w-auto sm:gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isPending}
              className="flex-1 border-[#E8D5B5] text-[#6B5D4F] hover:bg-[#E8D5B5]/20 sm:flex-initial"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bỏ qua, dùng mặc định
            </Button>
            <Button
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex-1 bg-[#2C2416] text-[#FEFBF6] hover:bg-[#3D3225] sm:flex-initial"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đo ngay (1 phút)
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleNext}
            disabled={isNextDisabled}
            className="bg-[#2C2416] text-[#FEFBF6] hover:bg-[#3D3225]"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tiếp tục
          </Button>
        )}
      </div>
    </div>
  );
}
