'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepIndicator } from './step-indicator';
import { ScreenBodyMetrics } from './screen-body-metrics';
import { saveOnboardingScreen } from '@/lib/onboarding/actions';
import { WIZARD_DEFAULTS } from '@/lib/onboarding/constants';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';

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

  const screenOneDefaults = buildScreenOneDefaults(
    initialProfile,
  );

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
            onChange={(data) =>
              handleScreenChange(1, data)
            }
          />
        )}
        {currentStep >= 2 && currentStep <= 4 && (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            Coming in Plan 03
          </div>
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
        <Button
          onClick={handleNext}
          disabled={isPending || !screenData[currentStep]}
        >
          {isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {currentStep >= TOTAL_STEPS
            ? 'Complete'
            : 'Next'}
        </Button>
      </div>
    </div>
  );
}
