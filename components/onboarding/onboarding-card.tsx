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
    <div className="relative overflow-hidden rounded-2xl border border-[#E8D5B5]/40 bg-[#FFFCF8] p-6 shadow-sm transition-all hover:shadow-md">
      <div className="absolute top-0 left-0 h-1 w-full bg-[#F0EAE0]">
        <div
          className="h-full bg-[#C9A87C] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-4 right-4 z-20 rounded-full p-2 text-[#8B7355] transition-colors hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]"
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mr-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-xl flex-1">
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#F0EAE0]/60 px-2.5 py-0.5 font-medium text-[#8B7355] text-[10px] uppercase tracking-widest"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A87C]"></span>
            Thiết lập chưa hoàn tất
          </div>
          <h3
            className="mb-1 font-medium text-[#2C2416] text-xl"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Sẵn sàng khám phá?
          </h3>
          <p
            className="text-[#8B7355] text-sm leading-relaxed"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Chỉ cần vài bước đơn giản để Nhẩm AI hiểu khẩu vị và thói quen của
            riêng bạn.
          </p>
        </div>

        <div className="flex-shrink-0">
          <Link
            href="/onboarding"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2C2416] px-6 font-medium text-[#FFFCF8] text-sm transition-colors hover:bg-[#3D3425]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Tiếp tục thiết lập
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
