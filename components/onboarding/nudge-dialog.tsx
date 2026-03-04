'use client';

import { useRouter } from 'next/navigation';
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
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // SSR-safe localStorage read
  useEffect(() => {
    setMounted(true);
    setDismissCount(
      parseInt(localStorage.getItem(NUDGE_DISMISS_KEY) ?? '0', 10)
    );
  }, []);

  // 7-day trigger
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const shouldShowTimeTrigger = daysSinceCreation >= 7;

  // Show dialog when conditions are met
  useEffect(() => {
    if (
      mounted &&
      onboardingStep < ONBOARDING_REQUIRED_STEP &&
      shouldShowTimeTrigger &&
      dismissCount < 2
    ) {
      setOpen(true);
    }
  }, [mounted, onboardingStep, shouldShowTimeTrigger, dismissCount]);

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
      <DialogContent className="border-[#E8D5B5]/60 bg-[#FEFBF6] sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-[#2C2416]"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Hồ sơ dinh dưỡng chưa hoàn tất
          </DialogTitle>
          <DialogDescription
            className="text-[#6B5D4F]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Bạn đã dùng ứng dụng được 1 tuần! Hoàn tất hồ sơ giúp AI tính toán
            dinh dưỡng chính xác hơn.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="border-[#E8D5B5] text-[#6B5D4F] hover:bg-[#E8D5B5]/20 hover:text-[#2C2416]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Để sau
          </Button>
          <Button
            onClick={handleGoToOnboarding}
            className="bg-[#2C2416] text-[#FEFBF6] hover:bg-[#3D3225]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Hoàn tất ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
