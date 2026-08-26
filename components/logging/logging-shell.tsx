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
import { PaywallDialog } from '@/components/billing/paywall/paywall-dialog';
import { TrialBanner } from '@/components/billing/subscription/trial-banner';
import { FeedArea } from '@/components/logging/feed/feed-area';
import { MobileTimelinePicker } from '@/components/logging/sidebar/mobile-timeline-picker';
import { TimelineSidebar } from '@/components/logging/sidebar/timeline-sidebar';
import {
  buildAllTimelineDates,
  todayDateString,
} from '@/components/logging/sidebar/timeline-utils';
import { usePrefetchDates } from '@/hooks/meals/queries/use-prefetch-dates';
import { usePathname, useRouter } from '@/i18n/navigation';
import { loadMealDates } from '@/lib/actions/meals/load-meals';
import type { LoggingProfile } from '@/lib/domain/logging/types';

interface LoggingShellProps {
  profile: LoggingProfile;
  initialMeal?: string;
  initialDate?: string;
  // Signed-in user's email — pre-fills the web checkout in the paywall.
  email?: string | null;
  /**
   * The server's answer to "does the opening day hold anything?", so the
   * composer paints where it belongs instead of docking and then correcting.
   * Undefined when the server could not answer honestly.
   */
  initiallyHasEntries?: boolean;
}

export function LoggingShell({
  profile,
  initialMeal,
  initialDate,
  email,
  initiallyHasEntries,
}: LoggingShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = useMemo(() => todayDateString(), []);
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? today);
  // The server answered for the day the page OPENED on. Navigating the timeline
  // is a different question, and answering it with a stale hint would put the
  // composer in the middle of a day that has meals in it.
  const openingDate = useRef(selectedDate).current;
  // Paywall opened by a pre-stream 402 from the analyze endpoint. The
  // TrialBanner owns its OWN paywall for the upgrade CTA; this one covers the
  // hard-locked (trial-expired / not-entitled) case where the banner is hidden.
  const [paywallOpen, setPaywallOpen] = useState(false);
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

  // The timeline splits at LG, not MD. At md the page carried three columns —
  // the app rail (260), this sidebar (252) and the feed — which left the feed
  // about 160px on a 768px tablet: too narrow for a meal card, and narrow
  // enough that the day's gauge strip wrapped. Below lg the date chip carries
  // the same navigation in one row and the feed gets the width back.
  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-0 overflow-hidden lg:h-full lg:flex-row lg:gap-3">
      <MobileTimelinePicker
        {...timelineState}
        isRetrying={isFetching && !isPending}
      />
      <TimelineSidebar {...timelineState} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <TrialBanner userId={profile.userId} email={email} />
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
          onPaymentRequired={() => setPaywallOpen(true)}
          initiallyHasEntries={
            selectedDate === openingDate ? initiallyHasEntries : undefined
          }
        />
      </div>

      <PaywallDialog
        key={profile.userId}
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        userId={profile.userId}
        email={email}
      />
    </div>
  );
}
