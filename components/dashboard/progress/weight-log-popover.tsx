'use client';

import { Plus } from 'lucide-react';
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
 * Reads "Log weight" until today has an entry, then "Update" for clarity.
 */
export function WeightLogPopover({
  currentWeight,
  todayWeight,
  todayDate,
}: WeightLogPopoverProps) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const hasTodayWeight = typeof todayWeight === 'number';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="xs"
          className="h-9 shrink-0 gap-1.5 rounded-xl bg-kallo-btn px-3 text-white hover:bg-kallo-btn-hover"
        >
          <Plus aria-hidden className="h-4 w-4" />
          {hasTodayWeight ? t('weightCard.update') : t('weightCard.logWeight')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-xl border-kallo-border/60 bg-card p-3 text-kallo-text shadow-kallo-text/[0.06] shadow-lg"
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
