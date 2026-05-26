'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { FeedArea } from '@/components/logging/feed/feed-area';
import { MobileTimelinePicker } from '@/components/logging/sidebar/mobile-timeline-picker';
import { TimelineSidebar } from '@/components/logging/sidebar/timeline-sidebar';
import {
  buildAllTimelineDates,
  todayDateString,
} from '@/components/logging/sidebar/timeline-utils';
import { usePrefetchDates } from '@/hooks/use-prefetch-dates';
import { usePathname, useRouter } from '@/i18n/navigation';
import { loadMealDates } from '@/lib/actions/meals';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = useMemo(() => todayDateString(), []);
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? today);
  const lastUrlDateRef = useRef(initialDate ?? today);
  const [isDateNavigationPending, startDateNavigationTransition] =
    useTransition();

  const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), []);

  const {
    data: dates = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['meal-dates', profile.userId, timezoneOffset],
    queryFn: () => loadMealDates({ timezoneOffset }),
    staleTime: 60_000,
  });

  usePrefetchDates(selectedDate);

  const allDates = useMemo(
    () => buildAllTimelineDates({ dates, today, selectedDate }),
    [dates, selectedDate, today]
  );

  const updateSearchParams = useCallback(
    (nextDate: string, options?: { clearMeal?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('date', nextDate);
      if (options?.clearMeal) {
        params.delete('meal');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      startDateNavigationTransition(() => {
        updateSearchParams(date);
      });
    },
    [updateSearchParams]
  );

  const handleInitialMealApplied = useCallback(() => {
    updateSearchParams(selectedDate, { clearMeal: true });
  }, [selectedDate, updateSearchParams]);

  // Reconcile browser back/forward/external URL changes. This intentionally
  // runs only when the URL changes; otherwise a local click can be reverted by
  // the still-stale searchParams value before router.replace completes.
  useEffect(() => {
    const urlDate = searchParams.get('date');
    if (!urlDate || !/^\d{4}-\d{2}-\d{2}$/.test(urlDate)) return;

    if (urlDate === lastUrlDateRef.current) return;

    lastUrlDateRef.current = urlDate;
    setSelectedDate(urlDate);
  }, [searchParams]);

  const timelineState = {
    dates,
    allDates,
    today,
    selectedDate,
    isPending,
    isError,
    onRetry: () => {
      void refetch();
    },
    onSelectDate: handleSelectDate,
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-0 overflow-hidden md:h-[calc(100vh-1.5rem)] md:flex-row md:gap-3">
      <MobileTimelinePicker
        {...timelineState}
        isRetrying={isFetching && !isPending}
      />
      <TimelineSidebar {...timelineState} />
      <FeedArea
        selectedDate={selectedDate}
        today={today}
        profile={profile}
        initialMeal={initialMeal}
        isDateNavigationPending={isDateNavigationPending}
        onInitialMealApplied={
          initialMeal ? handleInitialMealApplied : undefined
        }
        onSelectDate={handleSelectDate}
      />
    </div>
  );
}
