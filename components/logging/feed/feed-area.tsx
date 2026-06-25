'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheatOccasionChips } from '@/components/logging/feed/cheat-occasion-chips';
import { CheatSliderCard } from '@/components/logging/feed/cheat-slider-card';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { MealEntry } from '@/components/logging/feed/meal-entry';
import { PartialDayNotice } from '@/components/logging/feed/partial-day-notice';
import { PartialYesterdayPrompt } from '@/components/logging/feed/partial-yesterday-prompt';
import { PersistedMealCard } from '@/components/logging/feed/persisted-meal-card';
import { StreamingMealEntry } from '@/components/logging/feed/streaming-meal-entry';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import {
  MealInput,
  type MealInputHandle,
} from '@/components/logging/input/meal-input';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { addDays } from '@/components/logging/sidebar/timeline-utils';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import { useFeedSubmit } from '@/hooks/use-feed-submit';
import { loggingDayKeys, useLoggingDay } from '@/hooks/use-logging-day';
import {
  useConfirmMeal,
  useDuplicateMeal,
  useSaveManualMeal,
  useUpdateMeal,
} from '@/hooks/use-meal-mutations';
import { useRecentCheatOccasions } from '@/hooks/use-recent-cheat-occasions';
import { useStreamAnalysis } from '@/hooks/use-stream-analysis';
import { useStreamingTerminalEffects } from '@/hooks/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/use-submit-guard';
import {
  deleteMealAction,
  type LoggingDayData,
  type PersistedMeal,
  type RecentCheatOccasion,
  stageCheatRepeatAction,
} from '@/lib/actions/meals';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import { rowIsComplete } from '@/lib/logging/manual-logging';
import { isLikelyPartialDay } from '@/lib/nutrition/pattern/completeness';
import type { CheatIntensity, CheatSliderLevels } from '@/lib/types/cheat';
import type {
  ChatMessage,
  MacroBreakdown,
  MealQuantityEdit,
  StreamingPhase,
} from '@/lib/types/meal';
import { cn } from '@/lib/utils';
import { MEAL_TEXT_MAX_LENGTH } from '@/lib/validation';

const emptyMacros: MacroBreakdown = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

function toStreamingPhase(status: string): StreamingPhase {
  switch (status) {
    case 'decomposing':
      return 'decomposing';
    case 'matching':
      return 'matching';
    case 'estimating':
      return 'estimating';
    case 'assembling':
      return 'assembling';
    case 'done':
    case 'error':
      return 'assembling';
    default:
      return 'waiting';
  }
}

interface FeedAreaProps {
  selectedDate: string;
  today: string;
  profile: LoggingProfile;
  initialMeal?: string;
  isDateNavigationPending?: boolean;
  onInitialMealApplied?: () => void;
  onSelectDate: (date: string) => void;
}

function MacroSummarySkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {[64, 52, 58, 48].map((width, index) => (
        <div
          key={index}
          className="rounded-2xl border border-nham-border/50 bg-nham-hover/25 p-3"
        >
          <div
            className="mb-2 h-3 rounded-full bg-nham-border/70"
            style={{ width }}
          />
          <div className="h-5 w-16 rounded-full bg-nham-accent/25" />
        </div>
      ))}
    </div>
  );
}

function LoggingDaySkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="logging-day-skeleton"
      className="mx-auto w-full max-w-3xl pl-6 sm:pl-12"
    >
      <div className="flex animate-pulse flex-col gap-8">
        {[0, 1].map((item) => (
          <div key={item} className="group relative">
            <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/50 group-last:bg-transparent" />
            <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent/70 bg-nham-surface" />
            <div className="mb-2 h-3 w-16 rounded-full bg-nham-border/70" />
            <div className="rounded-2xl border border-nham-border/60 bg-nham-hover/20 p-5 shadow-sm">
              <div className="mb-4 h-5 w-2/3 rounded-full bg-nham-border/70" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-nham-border/60" />
                <div className="h-3 w-5/6 rounded-full bg-nham-border/50" />
                <div className="h-3 w-3/5 rounded-full bg-nham-border/40" />
              </div>
              <div className="mt-5 flex items-center justify-between border-nham-border/50 border-t border-dashed pt-3">
                <div className="h-3 w-28 rounded-full bg-nham-border/50" />
                <div className="h-4 w-16 rounded-full bg-nham-accent/25" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoggingDayErrorStateProps {
  onRetry: () => void;
  isRetrying: boolean;
}

function LoggingDayErrorState({
  onRetry,
  isRetrying,
}: LoggingDayErrorStateProps) {
  const t = useTranslations('logging.feedArea');

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-nham-danger/30 bg-nham-danger/10 p-4 text-nham-text shadow-sm"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-nham-danger"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{t('loadErrorTitle')}</p>
            <p className="mt-1 text-nham-text-muted text-sm">
              {t('loadErrorDescription')}
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              aria-busy={isRetrying}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-nham-danger/15 px-3.5 py-2 font-medium text-nham-danger text-sm transition-colors hover:bg-nham-danger/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRetrying && 'animate-spin')}
                aria-hidden="true"
              />
              {t('retryDay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// "Fix with words" (natural-language refine) is hidden for now. It currently
// re-runs the whole AI pipeline on the meal's text — a re-log masquerading as an
// edit (it re-estimates every item and drops prior manual edits). It stays off
// until reworked into a surgical, single-item correction (tracked separately).
// The handler and its identity-preserving plumbing remain wired, so flipping
// this back to `true` restores the feature with the corrected behavior.
const REFINE_ENABLED = false;

export function FeedArea({
  selectedDate,
  today,
  profile,
  initialMeal,
  isDateNavigationPending = false,
  onInitialMealApplied,
  onSelectDate,
}: FeedAreaProps) {
  const t = useTranslations('logging.feedArea');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<MealInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();
  const queryClient = useQueryClient();
  const { guard } = useSubmitGuard();

  // Remove a meal with a 5-second undo. The card is dropped from the day cache
  // immediately so the calorie ring and macro bars heal on screen; the server
  // delete is deferred until the toast closes, so "undo" just restores the
  // snapshot (no re-insert needed). Mis-logged meals were previously permanent.
  const handleDeleteMeal = useCallback(
    (mealId: string) => {
      const filter = {
        queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
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
          queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
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
    [profile.userId, selectedDate, queryClient, t]
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
          queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
        })
        .some(([, data]) =>
          data?.persistedMeals.some((meal) => meal.id === mealId)
        );
      queryClient.setQueriesData<LoggingDayData>(
        {
          queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
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
              queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
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
        queryKey: loggingDayKeys.byUserDate(profile.userId, selectedDate),
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(selectedDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
    [profile.userId, selectedDate, queryClient, t]
  );
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  // Session-scoped dismissal for the "yesterday under-logged" prompt. FeedArea
  // stays mounted across date navigation, so this survives clicking through to
  // yesterday and back; a hard reload re-arms the once-daily nudge.
  const [yesterdayPromptDismissed, setYesterdayPromptDismissed] =
    useState(false);

  const lastPrefilledMealRef = useRef<string | null>(null);
  // Input mode: normal / manual / cheat.
  const [loggingMode, setLoggingMode] = useState<InputMode>('normal');
  // Indulgence magnitude (like an AI "thinking" level) — scales the estimate.
  const [cheatIntensity, setCheatIntensity] =
    useState<CheatIntensity>('medium');
  // "Log it again" — re-staging a past cheat occasion (a quick DB insert, no AI).
  const [isStagingRepeat, setIsStagingRepeat] = useState(false);
  const isCheat = loggingMode === 'cheat';
  const recentCheatOccasions = useRecentCheatOccasions(profile.userId, isCheat);

  // Auto-submit the handed-off meal once the prefill effect has armed it. The
  // dashboard composer used to navigate here and only re-insert the text,
  // forcing the user to tap send a second time (the double-submit). We now
  // submit the handoff for them. Kept in a ref so the prefill effect (which
  // runs before handleSubmit is defined) can arm it without a dependency cycle.
  const pendingAutoSubmitRef = useRef(false);

  // Prefill from dashboard meal trigger; re-runs when initialMeal changes so
  // repeated dashboard→logging handoffs while the component stays mounted work.
  useEffect(() => {
    if (!initialMeal || lastPrefilledMealRef.current === initialMeal) return;
    lastPrefilledMealRef.current = initialMeal;
    inputRef.current?.setText(initialMeal);
    inputRef.current?.focus();
    // Cheat handoffs go through their own slider path; only precise text
    // auto-submits. The dashboard composer never hands off in cheat mode.
    pendingAutoSubmitRef.current = !isCheat;
    onInitialMealApplied?.();
  }, [initialMeal, isCheat, onInitialMealApplied]);

  const {
    data: loggingDay,
    isError: isDayError,
    isFetching,
    isLoading,
    refetch: refetchLoggingDay,
  } = useLoggingDay(profile.userId, selectedDate);
  const isDayLoading = isLoading || isDateNavigationPending;
  const isDayRetrying = isFetching && !isLoading;
  const persistedMeals = loggingDay?.persistedMeals ?? [];
  const orderedPersistedMeals = useMemo(
    () =>
      persistedMeals.toSorted((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [persistedMeals]
  );
  const pendingConfirmations = loggingDay?.pendingConfirmations ?? [];

  // Mutations
  const confirmMeal = useConfirmMeal(profile.userId);
  const updateMeal = useUpdateMeal(profile.userId, selectedDate);
  const saveManualMeal = useSaveManualMeal(profile.userId);
  const duplicateMeal = useDuplicateMeal(profile.userId);

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
    [duplicateMeal, selectedDate, t]
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    });
  }, []);

  // NL-refine: re-run the analysis waterfall on the meal's text plus a plain
  // correction, then replace the meal. We reuse the streaming surface — a fresh
  // pending card streams in exactly like a new log — and register the old meal
  // id so confirming the correction deletes the original (no stacking).
  const handleRefineMeal = useCallback(
    (
      meal: { id: string; rawInput: string; loggedAt: string },
      correction: string
    ) => {
      if (stream.isAnalyzing) return;
      // The pipeline reads the whole meal afresh; the parenthetical carries the
      // correction as a same-line aside so decomposition keeps the dish context.
      // The server caps messages at MEAL_TEXT_MAX_LENGTH — when the original
      // text plus the correction (and the 3 joining chars) would exceed it,
      // truncate the original so the analysis is never rejected.
      const baseBudget = MEAL_TEXT_MAX_LENGTH - correction.length - 3;
      const base =
        meal.rawInput.length > baseBudget
          ? meal.rawInput.slice(0, Math.max(baseBudget, 0)).trimEnd()
          : meal.rawInput;
      const combined = `${base} (${correction})`;
      const assistantMsgId = crypto.randomUUID();
      replacedMealByMsgIdRef.current.set(assistantMsgId, meal.id);
      setStreamingMsgId(assistantMsgId);
      lastAnalysisIdRef.current = null;
      lastErrorRef.current = null;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          userInput: combined,
          loggedDate: selectedDate,
          timestamp: new Date(),
          isStreaming: true,
          streamingPhase: 'waiting',
        },
      ]);
      scrollToBottom();

      void stream.analyze({
        message: combined,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        // Keep the corrected meal anchored to the original's instant/slot.
        inheritLoggedAt: meal.loggedAt,
      });
    },
    [stream, selectedDate, scrollToBottom]
  );

  // Compute daily totals from persisted meals
  const targets = useMemo(
    () => ({
      calories: profile.calorieTarget,
      protein: profile.proteinTargetG,
      carbs: profile.carbsTargetG,
      fat: profile.fatTargetG,
    }),
    [
      profile.calorieTarget,
      profile.proteinTargetG,
      profile.carbsTargetG,
      profile.fatTargetG,
    ]
  );

  const dailyTotals = useMemo(() => {
    if (persistedMeals.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const total = sumDisplayedNutrition(
      persistedMeals.map((meal) => meal.nutrition)
    );

    return {
      calories: Math.round(total.caloriesKcal ?? 0),
      protein: Math.round(total.proteinG ?? 0),
      carbs: Math.round(total.carbohydrateG ?? 0),
      fat: Math.round(total.fatG ?? 0),
    };
  }, [persistedMeals]);

  const hasUnknownDailyMacros = useMemo(
    () =>
      persistedMeals.some(
        (meal) =>
          meal.nutrition.caloriesKcal == null ||
          meal.nutrition.proteinG == null ||
          meal.nutrition.carbohydrateG == null ||
          meal.nutrition.fatG == null
      ),
    [persistedMeals]
  );

  const lastAnalysisIdRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  // NL-refine bookkeeping: maps a refine streaming-message id → the persisted
  // meal it replaces. When that re-analysis is confirmed, the old meal is
  // deleted so the corrected meal supersedes it instead of stacking.
  const replacedMealByMsgIdRef = useRef<Map<string, string>>(new Map());

  const { handleSubmit } = useFeedSubmit({
    stream,
    selectedDate,
    inputRef,
    setMessages,
    setStreamingMsgId,
    scrollToBottom,
    guard,
    lastAnalysisIdRef,
    lastErrorRef,
    isCheat,
    cheatIntensity,
  });

  // Fire the armed handoff once the input is prefilled and not already
  // analyzing. handleSubmit reads the freshly-set text from the input ref.
  useEffect(() => {
    if (!pendingAutoSubmitRef.current || stream.isAnalyzing) return;
    pendingAutoSubmitRef.current = false;
    void handleSubmit();
  }, [handleSubmit, stream.isAnalyzing]);

  // Manual (Cronometer-style) submit: ingredient ids + grams straight to the
  // save endpoint — deterministic, no streaming analysis and no AI call.
  const handleManualSubmit = useCallback(() => {
    const rows = (inputRef.current?.getManualRows() ?? []).filter(
      rowIsComplete
    );
    if (rows.length === 0 || saveManualMeal.isPending) return;

    saveManualMeal.mutate(
      {
        mealId: crypto.randomUUID(),
        originDate: selectedDate,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        rows,
      },
      {
        onSuccess: () => {
          // Clear only after the save lands — on failure the rolled-back card
          // would otherwise leave the user with an empty composer and no way to
          // recover the rows they typed.
          inputRef.current?.clear();
          toast.success(t('savedMeal'));
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('saveError'));
        },
      }
    );
    scrollToBottom();
  }, [saveManualMeal, selectedDate, scrollToBottom, t]);

  const handleAnalysisComplete = useCallback(() => {
    const originDate =
      messages.find((message) => message.id === streamingMsgId)?.loggedDate ??
      selectedDate;

    // byUserDate is a 3-element key; the actual query uses byUserDateOffset
    // (4 elements, including the tz offset). This relies on TanStack Query's
    // default prefix matching to invalidate it — do not add `exact: true` here
    // or the yesterday-prompt/day view will show stale totals after a re-log.
    //
    // refetchType: 'none' marks the day stale WITHOUT launching a background
    // refetch. The pending card already renders from the local streamed
    // message, so no immediate network read is needed here — and that refetch
    // (which captures the pre-save snapshot) could otherwise resolve after a
    // confirm and clobber the just-saved meal, leaving the calorie ring stale.
    // The confirm mutation's onSettled refetch reconciles authoritative state.
    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(profile.userId, originDate),
      refetchType: 'none',
    });
    queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
  }, [messages, profile.userId, queryClient, selectedDate, streamingMsgId]);

  useStreamingTerminalEffects({
    stream,
    streamingMsgId,
    setStreamingMsgId,
    setMessages,
    scrollToBottom,
    lastAnalysisIdRef,
    lastErrorRef,
    onAnalysisComplete: handleAnalysisComplete,
  });

  const handleConfirmMeal = (
    message: ChatMessage,
    edits: MealQuantityEdit[]
  ) => {
    // The caller already holds the fully-built message — from either the local
    // stream or a server-loaded pending confirmation — so the optimistic cache
    // update can build the meal straight from it. (Re-deriving it from
    // `messages` here would miss server-backed pending cards, which never enter
    // that array, and silently drop the save.)
    //
    // Guard FIRST: without a parsedMeal/analysisId there is nothing to confirm,
    // and filtering on an `undefined` analysisId below would drop every message
    // that DOES have one.
    if (!message.parsedMeal || !message.analysisId) return;
    // Drop any local copy before mutate so the optimistic cache update in
    // useConfirmMeal does not briefly expose it as an unsaved card. This is a
    // no-op for server-loaded pending cards.
    setMessages((prev) =>
      prev.filter(
        (m) => m.id !== message.id && m.analysisId !== message.analysisId
      )
    );
    // Client-minted id: doubles as the persisted row's PK and an idempotency
    // key, so the optimistic card and the refetched row share one stable React
    // key (no remount/re-fade after save).
    const mealId = crypto.randomUUID();
    // If this card came from an NL-refine, the meal it corrects is deleted on
    // confirm so the correction supersedes the original rather than stacking.
    const replacedMealId = replacedMealByMsgIdRef.current.get(message.id);
    confirmMeal.mutate(
      {
        analysisId: message.analysisId,
        mealId,
        originDate: selectedDate,
        parsedMeal: message.parsedMeal,
        rawInput: message.userInput ?? message.content,
        loggedAt: message.timestamp.toISOString(),
        edits: edits.length > 0 ? edits : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('savedMeal'));
          if (replacedMealId) {
            replacedMealByMsgIdRef.current.delete(message.id);
            void replaceOldMeal(replacedMealId);
          }
        },
      }
    );
  };

  const handleConfirmCheatMeal = (
    message: ChatMessage,
    levels: CheatSliderLevels
  ) => {
    // Take the rendered message directly rather than re-finding it in `messages`:
    // a server-loaded pending cheat card is rendered from `pendingConfirmations`
    // and never enters `messages`, so a lookup there would miss it and silently
    // drop the confirm. (Mirrors handleConfirmMeal.)
    if (!message.analysisId || !message.cheatSpec) return;
    setMessages((prev) =>
      prev.filter(
        (m) => m.id !== message.id && m.analysisId !== message.analysisId
      )
    );
    const mealId = crypto.randomUUID();
    confirmMeal.mutate(
      {
        analysisId: message.analysisId,
        mealId,
        originDate: selectedDate,
        // Cheat meals have no ParsedMeal; the optimistic card is built from the
        // spec + levels instead.
        parsedMeal: { mealName: '', items: [], totalMacros: emptyMacros },
        rawInput: message.userInput ?? message.content,
        loggedAt: message.timestamp.toISOString(),
        levels,
        cheat: { spec: message.cheatSpec, levels },
      },
      {
        onSuccess: () => {
          toast.success(t('savedMeal'));
        },
      }
    );
  };

  // Vague-input fallback: re-run the cheat estimator with the chosen answer.
  const handleCheatClarify = (message: ChatMessage, answer: string) => {
    setStreamingMsgId(message.id);
    lastAnalysisIdRef.current = null;
    lastErrorRef.current = null;
    // Update the local message in place, or seed it if this card came from a
    // server pending row (not yet in `messages`) — so the streaming overlay has
    // a message to attach to.
    setMessages((prev) =>
      prev.some((m) => m.id === message.id)
        ? prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  cheatSpec: undefined,
                  isStreaming: true,
                  streamingPhase: 'waiting',
                }
              : m
          )
        : [
            ...prev,
            {
              ...message,
              cheatSpec: undefined,
              isStreaming: true,
              streamingPhase: 'waiting',
            },
          ]
    );
    void stream.analyze({
      message: message.userInput ?? message.content,
      loggedDate: selectedDate,
      timezoneOffset: new Date().getTimezoneOffset(),
      mode: 'cheat',
      cheatIntensity,
      clarifyAnswer: answer,
    });
  };

  // "Log it again": re-stage a past cheat occasion's sliders (seeded with last
  // time's amounts) without re-running the estimator, then surface the card.
  const handleRepeatCheat = async (occasion: RecentCheatOccasion) => {
    if (isStagingRepeat || stream.isAnalyzing) return;
    setIsStagingRepeat(true);
    try {
      const staged = await stageCheatRepeatAction({
        sourceMealId: occasion.mealId,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          cheatSpec: staged.spec,
          userInput: staged.rawInput,
          timestamp: new Date(staged.loggedAt),
          loggedDate: selectedDate,
          analysisId: staged.analysisId,
        },
      ]);
      scrollToBottom();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('repeatError'));
    } finally {
      setIsStagingRepeat(false);
    }
  };

  // Derive display messages: overlay live streaming state onto the active message.
  const displayMessages = useMemo(() => {
    const selectedMessages = messages.filter(
      (message) => message.loggedDate === selectedDate
    );

    if (!streamingMsgId || stream.status === 'idle') return selectedMessages;

    return selectedMessages.map((msg) => {
      if (msg.id !== streamingMsgId) return msg;
      return {
        ...msg,
        isStreaming: true,
        streamingPhase: toStreamingPhase(stream.status),
        streamingItems:
          stream.items.length > 0 ? stream.items : msg.streamingItems,
        streamingCompletedItems:
          stream.completedItems.length > 0
            ? stream.completedItems
            : msg.streamingCompletedItems,
      };
    });
  }, [
    messages,
    selectedDate,
    streamingMsgId,
    stream.status,
    stream.items,
    stream.completedItems,
  ]);

  // Auto-scroll when streaming card grows
  const streamItemCount = stream.items.length + stream.completedItems.length;
  useEffect(() => {
    if (stream.isAnalyzing && streamItemCount > 0) {
      scrollToBottom();
    }
  }, [stream.isAnalyzing, streamItemCount, scrollToBottom]);

  // Analyses that still have a live, in-session card. We render those from the
  // local streamed message — it holds the user's in-progress slider levels /
  // quantity edits in component state. Rendering the server-pending twin instead
  // (after a background refetch lands `pendingConfirmations`) would mount a
  // different React element and reset that state mid-edit, so we suppress the
  // twin until the local card is gone (confirmed/dismissed).
  const localAnalysisIds = useMemo(
    () =>
      new Set(
        displayMessages
          .filter((m) => m.role === 'assistant' && m.analysisId)
          .map((m) => m.analysisId as string)
      ),
    [displayMessages]
  );

  const pendingMessages = useMemo<ChatMessage[]>(
    () =>
      pendingConfirmations
        .filter((pending) => !localAnalysisIds.has(pending.id))
        .map((pending) => ({
          id: `pending-${pending.id}`,
          role: 'assistant',
          content: '',
          parsedMeal: pending.parsedMeal,
          cheatSpec: pending.cheatSpec,
          userInput: pending.rawInput,
          timestamp: new Date(pending.loggedAt),
          loggedDate: selectedDate,
          analysisId: pending.id,
        })),
    [pendingConfirmations, selectedDate, localAnalysisIds]
  );

  const unconfirmedMessages = [
    ...pendingMessages,
    ...displayMessages.filter((m) => m.role === 'assistant'),
  ];
  const hasPendingMessages = pendingMessages.length > 0;
  const hasStreamingMessages = displayMessages.some(
    (message) => message.role === 'assistant'
  );
  const hasPersistedMeals = persistedMeals.length > 0;
  const hasContent =
    hasPersistedMeals || hasPendingMessages || hasStreamingMessages;
  // ChatGPT-style: before anything is logged the composer sits centered with
  // the prompt; once there's content it animates down to the bottom while the
  // cards animate in. Not mode-based — purely content-driven.
  const isEmptyComposer =
    !hasContent && !stream.isAnalyzing && !isDayLoading && !isDayError;

  const isToday = selectedDate === today;
  const isPastDay = selectedDate < today;
  const showPartialDayNotice =
    isPastDay &&
    !isDayLoading &&
    !isDayError &&
    !hasUnknownDailyMacros &&
    hasPersistedMeals &&
    !hasPendingMessages &&
    !hasStreamingMessages &&
    isLikelyPartialDay(dailyTotals.calories, profile.calorieTarget);

  return (
    <main className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden">
      {isToday && !yesterdayPromptDismissed && (
        <PartialYesterdayPrompt
          userId={profile.userId}
          yesterday={addDays(today, -1)}
          calorieTarget={profile.calorieTarget}
          onOpenDay={onSelectDate}
          onDismiss={() => setYesterdayPromptDismissed(true)}
        />
      )}

      <div
        className="shrink-0 bg-nham-surface px-3 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3"
        data-testid="macro-summary-region"
      >
        <div className="mx-auto max-w-4xl">
          {isDayLoading ? (
            <MacroSummarySkeleton />
          ) : isDayError ? null : hasUnknownDailyMacros ? (
            <div
              className="font-medium text-[11px] text-nham-text-muted/80"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('legacyMacroWarning')}
            </div>
          ) : (
            <MacroSummary totals={dailyTotals} targets={targets} />
          )}
        </div>
      </div>

      {showPartialDayNotice && (
        <div className="shrink-0 px-3 pb-2 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <PartialDayNotice
              calories={dailyTotals.calories}
              target={profile.calorieTarget}
            />
          </div>
        </div>
      )}

      {/* Body: the cards region + the composer. When empty, the composer is
          the centered element (no prompt above it — the input bar IS the
          empty state); once there's content the cards take the height and the
          composer animates down to the bottom. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isEmptyComposer && 'justify-center'
        )}
      >
        <div
          ref={scrollRef}
          className={cn(
            'flex flex-col overscroll-contain px-3 sm:px-6',
            isEmptyComposer
              ? 'shrink-0'
              : 'min-h-0 flex-1 overflow-y-auto py-3 sm:py-4'
          )}
          data-testid="meal-card-scroll"
        >
          {isDayLoading && <LoggingDaySkeleton />}

          {!isDayLoading && isDayError && (
            <LoggingDayErrorState
              isRetrying={isDayRetrying}
              onRetry={() => {
                void refetchLoggingDay();
              }}
            />
          )}

          {!isDayLoading && !isDayError && hasContent && (
            <div className="mx-auto w-full max-w-3xl pl-6 sm:pl-12">
              <div className="flex flex-col gap-5 sm:gap-8">
                {/* Persisted meals from DB */}
                <AnimatePresence initial={false}>
                  {orderedPersistedMeals.map((meal) => (
                    <PersistedMealCard
                      key={meal.id}
                      meal={meal}
                      onDelete={() => handleDeleteMeal(meal.id)}
                      onLogAgain={() => handleLogAgain(meal)}
                      onUpdate={(changes) => handleUpdateMeal(meal.id, changes)}
                      onRefine={
                        REFINE_ENABLED
                          ? (correction) =>
                              handleRefineMeal(
                                {
                                  id: meal.id,
                                  rawInput: meal.rawInput,
                                  loggedAt: meal.loggedAt,
                                },
                                correction
                              )
                          : undefined
                      }
                    />
                  ))}
                </AnimatePresence>

                {/* Streaming / unconfirmed messages */}
                <AnimatePresence initial={false}>
                  {unconfirmedMessages.map((msg) => {
                    if (msg.isStreaming) {
                      return <StreamingMealEntry key={msg.id} message={msg} />;
                    }

                    if (msg.cheatSpec) {
                      return (
                        <CheatSliderCard
                          key={msg.id}
                          spec={msg.cheatSpec}
                          userInput={msg.userInput}
                          timestamp={msg.timestamp}
                          isConfirming={confirmMeal.isPending}
                          onConfirm={(levels) =>
                            handleConfirmCheatMeal(msg, levels)
                          }
                          onClarify={(answer) =>
                            handleCheatClarify(msg, answer)
                          }
                        />
                      );
                    }

                    if (msg.parsedMeal) {
                      return (
                        <MealEntry
                          key={msg.id}
                          message={msg}
                          isConfirming={confirmMeal.isPending}
                          onConfirm={(edits) => handleConfirmMeal(msg, edits)}
                        />
                      );
                    }

                    // Error message display
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative"
                      >
                        <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
                        <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-danger bg-white" />
                        <div className="rounded-2xl border border-nham-danger/30 bg-nham-danger/10 p-4">
                          {msg.userInput && (
                            <p
                              className="mb-2 text-[13px] text-nham-text-muted"
                              style={{ fontFamily: 'Lora, serif' }}
                            >
                              {msg.userInput}
                            </p>
                          )}
                          <p
                            className="text-nham-danger text-sm"
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                            }}
                          >
                            {msg.content}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Composer — `layout` smoothly tweens it from the centered position
            (empty) down to the bottom once cards take the height above it. */}
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="shrink-0 px-3 pt-2 pb-3 sm:px-6 sm:pb-4"
        >
          {isCheat && (
            <CheatOccasionChips
              occasions={recentCheatOccasions.data ?? []}
              disabled={isStagingRepeat || stream.isAnalyzing}
              onSelect={handleRepeatCheat}
            />
          )}
          <div className="mx-auto w-full max-w-3xl">
            <MealInput
              ref={inputRef}
              onSubmit={
                loggingMode === 'manual' ? handleManualSubmit : handleSubmit
              }
              onCancel={() => {
                stream.cancel();
                if (streamingMsgId) {
                  setMessages((prev) =>
                    prev.filter((m) => m.id !== streamingMsgId)
                  );
                }
                setStreamingMsgId(null);
              }}
              disabled={stream.isAnalyzing}
              mode={loggingMode}
              onModeChange={setLoggingMode}
              cheatIntensity={cheatIntensity}
              onChangeIntensity={setCheatIntensity}
            />
          </div>
        </motion.div>
      </div>
    </main>
  );
}
