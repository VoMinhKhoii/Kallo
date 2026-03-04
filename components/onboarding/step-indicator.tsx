'use client';

import { cn } from '@/lib/utils';

const STEP_LABELS = [
  'Body Metrics & Goals',
  'Regional Profile',
  'Cooking Habits',
  'Portions',
];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({
  currentStep,
  totalSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center',
                  'rounded-full text-sm font-medium',
                  'transition-colors duration-200',
                  isCompleted &&
                    'bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-2 border-primary bg-primary/10 text-primary',
                  !isCompleted &&
                    !isCurrent &&
                    'border-2 border-muted-foreground/30 text-muted-foreground/50',
                )}
              >
                {isCompleted ? '✓' : step}
              </div>
              <span className="sr-only">
                {STEP_LABELS[i]}
              </span>
            </div>

            {/* Connecting line */}
            {step < totalSteps && (
              <div
                className={cn(
                  'h-0.5 w-8 sm:w-12',
                  'transition-colors duration-200',
                  step < currentStep
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
