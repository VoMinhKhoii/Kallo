'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  function getStepClass(step: number): string {
    if (step === currentStep) return 'w-6 bg-nham-ink';
    if (step < currentStep) return 'w-2 bg-nham-ink';
    return 'w-2 bg-[#EAE7E0]';
  }

  return (
    <div className="flex gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${getStepClass(i)}`}
        />
      ))}
    </div>
  );
}
