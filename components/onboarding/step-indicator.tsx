'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === currentStep
              ? 'w-6 bg-[#2C2416]'
              : i < currentStep
                ? 'w-2 bg-[#2C2416]'
                : 'w-2 bg-[#EAE7E0]'
          }`}
        />
      ))}
    </div>
  );
}
