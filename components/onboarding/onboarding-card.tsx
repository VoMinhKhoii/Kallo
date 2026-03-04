'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  return (
    <Card className="relative border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </button>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Hoàn tất hồ sơ dinh dưỡng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Giúp AI hiểu cách bạn nấu ăn và ước lượng phần ăn
          chính xác hơn. Chỉ mất 3 phút.
        </p>
        <Button asChild size="sm">
          <Link href="/onboarding">
            Tiếp tục thiết lập
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
