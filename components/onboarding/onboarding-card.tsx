'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';

interface OnboardingCardProps {
  onboardingStep: number;
  onDismiss: () => void;
}

export function OnboardingCard({
  onboardingStep,
  onDismiss,
}: OnboardingCardProps) {
  if (onboardingStep >= ONBOARDING_REQUIRED_STEP) {
    return null;
  }

  const stepsCompleted = onboardingStep;
  const totalSteps = ONBOARDING_REQUIRED_STEP;
  const progress = (stepsCompleted / totalSteps) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E8D5B5]/60 bg-[#FEFBF6]">
      {/* Progress bar at top */}
      <div className="h-1 w-full bg-[#E8D5B5]/30">
        <div
          className="h-full rounded-r-full bg-[#C9A87C] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 rounded-md p-1 text-[#B0A695] transition-colors hover:bg-[#E8D5B5]/30 hover:text-[#6B5D4F]"
          aria-label="Đóng"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <h3
          className="mb-1 font-medium text-[#2C2416] text-base"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Hoàn tất hồ sơ dinh dưỡng
        </h3>
        <p
          className="mb-3 text-[#6B5D4F] text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Giúp AI hiểu cách bạn nấu ăn chính xác hơn.{' '}
          <span className="text-[#8B7355]">
            {stepsCompleted}/{totalSteps} bước hoàn tất
          </span>
        </p>

        <Link
          href="/onboarding"
          className="group inline-flex items-center gap-1.5 rounded-lg bg-[#2C2416] px-4 py-2 font-medium text-[#FEFBF6] text-sm transition-colors hover:bg-[#3D3225]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Tiếp tục thiết lập
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
