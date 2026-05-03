'use client';

import { useState } from 'react';
import { FeedArea } from '@/components/logging/feed/feed-area';
import { TimelineSidebar } from '@/components/logging/sidebar/timeline-sidebar';
import { usePrefetchDates } from '@/hooks/use-prefetch-dates';
import type { Goal } from '@/lib/onboarding/types';

export interface LoggingProfile {
  userId: string;
  goal: Goal;
  aggression: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface LoggingShellProps {
  profile: LoggingProfile;
  initialMeal?: string;
  initialDate?: string;
}

export function LoggingShell({
  profile,
  initialMeal,
  initialDate,
}: LoggingShellProps) {
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate ?? todayDateString()
  );

  usePrefetchDates(selectedDate);

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <TimelineSidebar
        userId={profile.userId}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <FeedArea
        selectedDate={selectedDate}
        profile={profile}
        initialMeal={initialMeal}
      />
    </div>
  );
}
