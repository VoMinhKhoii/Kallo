'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface WeightLogPopoverProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
}

/**
 * The Progress card's log affordance — a filled button opening a focused
 * popover with the weight form (the web analogue of the Flutter card's
 * "Log weight" bottom sheet; the card itself stays a clean data surface).
 */
export function WeightLogPopover({
  currentWeight,
  todayWeight,
  todayDate,
}: WeightLogPopoverProps) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="xs"
          className="h-9 shrink-0 rounded-xl bg-nham-btn px-3 text-white hover:bg-nham-btn-hover"
        >
          {t('weightCard.logWeight')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-xl border-nham-border/60 bg-card p-3 text-nham-text shadow-lg shadow-nham-text/[0.06]"
      >
        <CompactWeightLog
          currentWeight={currentWeight}
          todayWeight={todayWeight}
          todayDate={todayDate}
          autoFocus
          onSaved={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
