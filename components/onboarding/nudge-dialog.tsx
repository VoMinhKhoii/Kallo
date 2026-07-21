'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from '@/i18n/navigation';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';

const NUDGE_DISMISS_KEY = 'onboarding_nudge_dismiss_count';

interface NudgeDialogProps {
  onboardingStep: number;
  accountCreatedAt: string | Date;
}

export function NudgeDialog({
  onboardingStep,
  accountCreatedAt,
}: NudgeDialogProps) {
  const router = useRouter();
  const [dismissCount, setDismissCount] = useState(0);
  const [open, setOpen] = useState(false);

  // SSR-safe: read localStorage + compute time trigger on mount only
  useEffect(() => {
    const storedCount = parseInt(
      localStorage.getItem(NUDGE_DISMISS_KEY) ?? '0',
      10
    );
    setDismissCount(storedCount);

    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(accountCreatedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (
      onboardingStep < ONBOARDING_TOTAL_STEPS &&
      daysSinceCreation >= 7 &&
      storedCount < 2
    ) {
      setOpen(true);
    }
  }, [onboardingStep, accountCreatedAt]);

  function handleDismiss() {
    const newCount = dismissCount + 1;
    localStorage.setItem(NUDGE_DISMISS_KEY, newCount.toString());
    setDismissCount(newCount);
    setOpen(false);
  }

  function handleGoToOnboarding() {
    setOpen(false);
    router.push('/onboarding');
  }

  // TODO (Phase 4): "after 3rd meal logged" trigger — check meal count from props/context
  // TODO (Phase 7): "first dashboard visit" trigger — check navigation event

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-2xl border border-nham-border/60 bg-[#FFFCF8] p-6 shadow-lg sm:max-w-md">
        <DialogHeader className="space-y-3 pb-2 text-left">
          <DialogTitle className="font-normal font-serif text-nham-text text-xl">
            Hồ sơ chưa hoàn tất
          </DialogTitle>
          <DialogDescription className="font-sans-display text-nham-text-muted text-sm leading-relaxed">
            Bạn đã dùng Kallo được 1 tuần! Hoàn tất hồ sơ giúp Kallo thông minh
            hơn và cá nhân hóa chính xác lượng dinh dưỡng cho riêng bạn.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="h-10 w-full rounded-xl px-4 font-medium font-sans-display text-nham-text-muted text-sm transition-colors hover:bg-nham-hover/50 hover:text-nham-text sm:w-auto"
          >
            Để sau
          </Button>
          <Button
            onClick={handleGoToOnboarding}
            className="h-10 w-full rounded-xl bg-nham-ink px-6 font-medium font-sans-display text-[#FFFCF8] text-sm transition-colors hover:bg-nham-ink-hover sm:w-auto"
          >
            Hoàn tất ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
