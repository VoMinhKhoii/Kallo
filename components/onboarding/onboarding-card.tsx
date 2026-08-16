'use client';

import { ArrowRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';

interface OnboardingCardProps {
  onboardingStep: number;
  onDismiss: () => void;
}

export function OnboardingCard({
  onboardingStep,
  onDismiss,
}: OnboardingCardProps) {
  const t = useTranslations('common');
  if (onboardingStep >= ONBOARDING_TOTAL_STEPS) {
    return null;
  }

  const stepsCompleted = onboardingStep;
  const totalSteps = ONBOARDING_TOTAL_STEPS;
  const progress = (stepsCompleted / totalSteps) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-kallo-border/40 bg-[#FFFCF8] p-6 shadow-sm transition-all hover:shadow-md">
      <div className="absolute top-0 left-0 h-1 w-full bg-kallo-hover">
        <div
          className="h-full bg-kallo-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-4 right-4 z-20 rounded-full p-2 text-kallo-text-muted transition-colors hover:bg-kallo-hover/60 hover:text-kallo-text"
        aria-label={t('close')}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mr-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-xl flex-1">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-kallo-hover/60 px-2.5 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text-muted uppercase tracking-widest">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-kallo-accent"></span>
            Thiết lập chưa hoàn tất
          </div>
          <h3 className="mb-1 font-normal font-serif text-kallo-text text-xl">
            Sẵn sàng khám phá?
          </h3>
          <p className="font-sans-display text-kallo-text-muted text-sm leading-relaxed">
            Chỉ cần vài bước đơn giản để Kallo AI hiểu khẩu vị và thói quen của
            riêng bạn.
          </p>
        </div>

        <div className="flex-shrink-0">
          <Link
            href="/onboarding"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-kallo-ink px-6 font-medium font-sans-display text-[#FFFCF8] text-sm transition-colors hover:bg-kallo-ink-hover"
          >
            Tiếp tục thiết lập
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
