'use client';

import { motion } from 'motion/react';

const STEP_LABELS = ['Chỉ số cơ thể', 'Vùng miền', 'Nấu ăn', 'Phần ăn'];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <p
          className="text-[#6B5D4F] text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <span className="font-medium text-[#2C2416]">Bước {currentStep}</span>
          <span className="mx-1 text-[#E8D5B5]">/</span>
          <span>{totalSteps}</span>
        </p>
        <p
          className="font-medium text-[#8B7355] text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {STEP_LABELS[currentStep - 1]}
        </p>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#E8D5B5]/40">
        <motion.div
          className="h-full rounded-full bg-[#2C2416]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
        />
      </div>
    </div>
  );
}
