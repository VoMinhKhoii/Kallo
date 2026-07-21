'use client';

import { useQueryClient } from '@tanstack/react-query';
import { InlineMealTrigger } from '@/components/dashboard/today/meal-trigger';
import { useDashboardDateRefresh } from '@/hooks/dashboard/use-dashboard-date-refresh';
import { useDashboardMealLog } from '@/hooks/dashboard/use-dashboard-meal-log';
import { useMyProfile } from '@/hooks/profile/use-profile';

/**
 * The dashboard's AI meal-input bar, reused verbatim at the top of Circle so
 * you can log a meal without leaving the surface. Stage 1 is log-only: the bar
 * streams the analysis and auto-saves to your diary (via useDashboardMealLog);
 * sharing that meal into a group stays the existing manual step.
 */
export function CircleMealBar() {
  const queryClient = useQueryClient();
  const todayDate = useDashboardDateRefresh(queryClient);
  const { data: profile } = useMyProfile();
  const { submit, streaming, restoredDraft } = useDashboardMealLog({
    userId: profile?.userId ?? '',
    todayDate,
  });

  // Hold the bar until we have the real userId so a submit can never target an
  // empty user; all hooks above still run unconditionally.
  if (!profile) return null;

  return (
    <div className="mb-3 shrink-0">
      <InlineMealTrigger
        onSubmitMeal={submit}
        streaming={streaming}
        restoredDraft={restoredDraft}
      />
    </div>
  );
}
