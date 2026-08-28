'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { useDuplicateMeal } from '@/hooks/meals/mutations/use-duplicate-meal';
import { useUpdateMeal } from '@/hooks/meals/mutations/use-update-meal';
import { deleteMealAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';

interface UseMealCardActionsParams {
  userId: string;
  selectedDate: string;
}

/**
 * The persistence actions on a saved meal card — remove (with undo), edit
 * amounts, log again, and the silent superseding delete used by NL-refine.
 * Extracted out of FeedArea: these touch only the day cache and the meal
 * mutations (never the streaming/messages state), so they form a self-contained
 * unit that keeps the feed component focused on streaming orchestration.
 */
export function useMealCardActions({
  userId,
  selectedDate,
}: UseMealCardActionsParams) {
  const t = useTranslations('logging.feedArea');
  const { requirePremium } = usePremiumGuard();
  const queryClient = useQueryClient();
  const updateMeal = useUpdateMeal(userId, selectedDate);
  const duplicateMeal = useDuplicateMeal(userId);

  // Remove a meal with a 5-second undo. The card is dropped from the day cache
  // immediately so the calorie ring and macro bars heal on screen; the server
  // delete is deferred until the toast closes, so "undo" just restores the
  // snapshot (no re-insert needed). Mis-logged meals were previously permanent.
  const handleDeleteMeal = useCallback(
    (mealId: string) => {
      const filter = {
        queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
      };
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);

      queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
        old
          ? {
              ...old,
              persistedMeals: old.persistedMeals.filter(
                (meal) => meal.id !== mealId
              ),
            }
          : old
      );

      let undone = false;
      const restore = () => {
        for (const [key, data] of snapshots) {
          queryClient.setQueryData(key, data);
        }
      };
      const commit = async () => {
        if (undone) return;
        try {
          await deleteMealAction({ mealId });
        } catch (error) {
          restore();
          toast.error(
            error instanceof Error ? error.message : t('deleteError')
          );
          return;
        }
        queryClient.invalidateQueries({
          queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
          refetchType: 'none',
        });
        queryClient.invalidateQueries({
          queryKey: dailyMealsKeys.byDate(selectedDate),
        });
        queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
      };

      toast(t('mealRemoved'), {
        duration: 5000,
        action: {
          label: t('undo'),
          onClick: () => {
            undone = true;
            restore();
          },
        },
        onAutoClose: commit,
        onDismiss: commit,
      });
    },
    [userId, selectedDate, queryClient, t]
  );

  // Silent superseding delete for an NL-refine: the corrected meal already
  // saved, so the original is dropped from the cache and server with no undo
  // toast (the correction IS the user's intent — an "undo" here would confuse).
  const replaceOldMeal = useCallback(
    async (mealId: string) => {
      // If the meal is already gone from the cache (e.g. removed by a racing
      // delete), the server call would only produce a spurious error toast.
      const stillInCache = queryClient
        .getQueriesData<LoggingDayData>({
          queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
        })
        .some(([, data]) =>
          data?.persistedMeals.some((meal) => meal.id === mealId)
        );
      queryClient.setQueriesData<LoggingDayData>(
        {
          queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
        },
        (old) =>
          old
            ? {
                ...old,
                persistedMeals: old.persistedMeals.filter(
                  (meal) => meal.id !== mealId
                ),
              }
            : old
      );
      if (stillInCache) {
        try {
          await deleteMealAction({ mealId });
        } catch (error) {
          // A not-found means another path already deleted it — the data is
          // correct, so stay silent. Anything else really left a duplicate:
          // refetch so the original meal resurfaces and the user can remove
          // it manually.
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('không tồn tại')) {
            toast.error(t('deleteError'));
            queryClient.invalidateQueries({
              queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
              refetchType: 'active',
            });
            queryClient.invalidateQueries({
              queryKey: dailyMealsKeys.byDate(selectedDate),
            });
            queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
            return;
          }
        }
      }
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(selectedDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
    [userId, selectedDate, queryClient, t]
  );

  // Persist an amount edit (gram overrides + per-row removals) for one meal.
  // The mutation reconciles the card in place from the authoritative response.
  const handleUpdateMeal = useCallback(
    async (
      mealId: string,
      changes: {
        edits: { id: string; newGrams: number }[];
        removeIds: string[];
      }
    ) => {
      await updateMeal.mutateAsync({
        mealId,
        edits: changes.edits.length > 0 ? changes.edits : undefined,
        removeIds: changes.removeIds.length > 0 ? changes.removeIds : undefined,
      });
      toast.success(t('mealUpdatedToast'));
    },
    [updateMeal, t]
  );

  // "Log again": reproduce the meal exactly (deterministic server-side copy of
  // its items) on the viewed day, rather than re-typing the text and re-running
  // the AI pipeline — which would yield fresh, drifted numbers and lose any
  // prior manual edits.
  const handleLogAgain = useCallback(
    (meal: PersistedMeal) => {
      // Before the optimistic paint: a refused relog must leave the feed
      // untouched rather than flash a card the server will reject.
      if (!requirePremium('relog')) return;
      if (duplicateMeal.isPending) return;
      const newMealId = crypto.randomUUID();
      duplicateMeal.mutate(
        {
          source: meal,
          newMealId,
          originDate: selectedDate,
          loggedDate: selectedDate,
          timezoneOffset: new Date().getTimezoneOffset(),
          loggedAt: new Date().toISOString(),
        },
        {
          onSuccess: () => toast.success(t('savedMeal')),
        }
      );
    },
    [duplicateMeal, selectedDate, t, requirePremium]
  );

  return { handleDeleteMeal, handleUpdateMeal, handleLogAgain, replaceOldMeal };
}
