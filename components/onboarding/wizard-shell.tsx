'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepIndicator } from './step-indicator';
import {
  ScreenBodyMetrics,
  type ScreenOneData,
} from './screen-body-metrics';
import { ScreenRegional } from './screen-regional';
import { ScreenCooking } from './screen-cooking';
import { ScreenPortions } from './screen-portions';
import { saveOnboardingScreen } from '@/lib/onboarding/actions';
import { WIZARD_DEFAULTS } from '@/lib/onboarding/constants';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';
import type { RegionalProfile } from '@/lib/onboarding/types';

type ProfileRow = NonNullable<
  Awaited<ReturnType<typeof getOnboardingProfile>>
>;

interface WizardShellProps {
  initialStep: number;
  initialProfile: ProfileRow | null;
}

const TOTAL_STEPS = 4;

function buildScreenOneDefaults(profile: ProfileRow | null) {
  return {
    biologicalSex:
      (profile?.biologicalSex as 'male' | 'female') ??
      undefined,
    weightKg: profile?.weightKg
      ? Number(profile.weightKg)
      : undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: profile?.age ?? undefined,
    activityLevel:
      (profile?.activityLevel as
        | 'sedentary'
        | 'light'
        | 'moderate'
        | 'very_active') ??
      WIZARD_DEFAULTS.activityLevel,
    goal:
      (profile?.goal as
        | 'cutting'
        | 'bulking'
        | 'maintaining') ?? WIZARD_DEFAULTS.goal,
    aggression:
      (profile?.aggression as
        | 'gentle'
        | 'moderate'
        | 'aggressive'
        | null) ?? WIZARD_DEFAULTS.aggression,
    carbSplit:
      (profile?.carbSplit as
        | 'moderate_carb'
        | 'lower_carb'
        | 'higher_carb') ?? WIZARD_DEFAULTS.carbSplit,
    deficitOverride: WIZARD_DEFAULTS.deficitOverride,
  };
}

export function WizardShell({
  initialStep,
  initialProfile,
}: WizardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [screenData, setScreenData] = useState<
    Record<number, Record<string, unknown>>
  >({});

  const handleScreenChange = useCallback(
    (step: number, data: Record<string, unknown>) => {
      setScreenData((prev) => ({ ...prev, [step]: data }));
    },
    [],
  );

  const handleNext = () => {
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

  const screenOneDefaults = buildScreenOneDefaults(
    initialProfile,
  );

  const screenTwoDefaults = {
    regionalProfile:
      (initialProfile?.regionalProfile as RegionalProfile) ??
      null,
  };

  const screenThreeDefaults = {
    oilUsage:
      (initialProfile?.oilUsage as
        | 'minimal'
        | 'normal'
        | 'heavy') ?? undefined,
    fatTrim:
      (initialProfile?.fatTrimPork as
        | 'trim'
        | 'eat_all'
        | 'by_dish') ?? undefined,
    boneAwareness:
      initialProfile?.boneAwareness ?? undefined,
    defaultRicePortion:
      (initialProfile?.defaultRicePortion as
        | 'small'
        | 'medium'
        | 'large') ?? undefined,
    sugarBraised:
      (initialProfile?.sugarBraised as
        | 'low'
        | 'medium'
        | 'high') ?? undefined,
  };

  const screenFourDefaults = {
    handSpanCm: initialProfile?.handSpanCm
      ? Number(initialProfile.handSpanCm)
      : null,
    knuckleDepthCm: initialProfile?.knuckleDepthCm
      ? Number(initialProfile.knuckleDepthCm)
      : null,
    bowlSizeMl:
      initialProfile?.bowlSizeMl ??
      WIZARD_DEFAULTS.bowlSizeMl,
    plateSizeMl:
      initialProfile?.plateSizeMl ??
      WIZARD_DEFAULTS.plateSizeMl,
  };

  // Get regional profile from screenData (step 2) or initial profile
  const currentRegionalProfile =
    (screenData[2]?.regionalProfile as RegionalProfile) ??
    screenTwoDefaults.regionalProfile;

  // Step 2 next disabled if no regional profile selected
  const isNextDisabled =
    isPending ||
    !screenData[currentStep] ||
    (currentStep === 2 &&
      !screenData[2]?.regionalProfile);

  return (
    <div className="space-y-8">
      <StepIndicator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
      />

      {/* Screen content */}
      <div>
        {currentStep === 1 && (
          <ScreenBodyMetrics
            defaultValues={screenOneDefaults}
            onChange={(data: ScreenOneData) =>
              handleScreenChange(
                1,
                data as unknown as Record<
                  string,
                  unknown
                >,
              )
            }
          />
        )}
        {currentStep === 2 && (
          <ScreenRegional
            defaultValues={screenTwoDefaults}
            onChange={(data) =>
              handleScreenChange(2, data)
            }
          />
        )}
        {currentStep === 3 && (
          <ScreenCooking
            defaultValues={screenThreeDefaults}
            regionalProfile={currentRegionalProfile}
            onChange={(data) =>
              handleScreenChange(
                3,
                data as unknown as Record<
                  string,
                  unknown
                >,
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
                data as unknown as Record<
                  string,
                  unknown
                >,
              )
            }
            onSkip={handleSkip}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep <= 1 || isPending}
        >
          Back
        </Button>
        {currentStep === 4 ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isPending}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Bỏ qua, dùng mặc định
            </Button>
            <Button
              onClick={handleNext}
              disabled={isNextDisabled}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Đo ngay (1 phút)
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleNext}
            disabled={isNextDisabled}
          >
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {currentStep >= TOTAL_STEPS
              ? 'Complete'
              : 'Next'}
          </Button>
        )}
      </div>
    </div>
  );
}
