'use client';

import { FeedCards } from '@/components/logging/feed/feed-cards';
import { FeedComposer } from '@/components/logging/feed/feed-composer';
import {
  LoggingDayErrorState,
  LoggingDaySkeleton,
} from '@/components/logging/feed/feed-day-states';
import { FeedHeader } from '@/components/logging/feed/feed-header';
import { PartialYesterdayPrompt } from '@/components/logging/feed/partial-day/partial-yesterday-prompt';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { addDays } from '@/components/logging/sidebar/timeline-utils';
import { useFeedController } from '@/hooks/meals/use-feed-controller';
import { cn } from '@/lib/utils';

interface FeedAreaProps {
  selectedDate: string;
  today: string;
  profile: LoggingProfile;
  initialMeal?: string;
  isDateNavigationPending?: boolean;
  onInitialMealApplied?: () => void;
  onSelectDate: (date: string) => void;
  onPaymentRequired?: () => void;
}

// "Fix with words" (natural-language refine) is hidden for now. It currently
// re-runs the whole AI pipeline on the meal's text — a re-log masquerading as an
// edit (it re-estimates every item and drops prior manual edits). It stays off
// until reworked into a surgical, single-item correction (tracked separately).
// The handler and its identity-preserving plumbing remain wired (in
// useConfirmHandlers), so flipping this back to `true` restores the feature
// with the corrected behavior.
const REFINE_ENABLED = false;

export function FeedArea({
  selectedDate,
  today,
  profile,
  initialMeal,
  isDateNavigationPending = false,
  onInitialMealApplied,
  onSelectDate,
  onPaymentRequired,
}: FeedAreaProps) {
  const feed = useFeedController({
    selectedDate,
    today,
    profile,
    initialMeal,
    isDateNavigationPending,
    onInitialMealApplied,
    onPaymentRequired,
  });
  const { day } = feed;

  return (
    <main className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden">
      {feed.isToday && !feed.yesterdayPromptDismissed && (
        <PartialYesterdayPrompt
          userId={profile.userId}
          yesterday={addDays(today, -1)}
          calorieTarget={profile.calorieTarget}
          onOpenDay={onSelectDate}
          onDismiss={() => feed.setYesterdayPromptDismissed(true)}
        />
      )}

      <FeedHeader
        isDayLoading={day.isDayLoading}
        isDayError={day.isDayError}
        hasUnknownDailyMacros={day.hasUnknownDailyMacros}
        dailyTotals={day.dailyTotals}
        targets={day.targets}
        showPartialDayNotice={feed.showPartialDayNotice}
        calorieTarget={profile.calorieTarget}
      />

      {/* Body: the cards region + the composer. When empty, the composer is
          the centered element (no prompt above it — the input bar IS the
          empty state); once there's content the cards take the height and the
          composer animates down to the bottom. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          feed.isEmptyComposer && 'justify-center'
        )}
      >
        <div
          ref={feed.scrollRef}
          className={cn(
            'flex flex-col overscroll-contain px-3 sm:px-6',
            feed.isEmptyComposer
              ? 'shrink-0'
              : 'min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 sm:py-4'
          )}
          data-testid="meal-card-scroll"
        >
          {day.isDayLoading && <LoggingDaySkeleton />}

          {!day.isDayLoading && day.isDayError && (
            <LoggingDayErrorState
              isRetrying={day.isDayRetrying}
              onRetry={() => {
                void day.refetchLoggingDay();
              }}
            />
          )}

          {!day.isDayLoading && !day.isDayError && feed.hasContent && (
            <FeedCards
              orderedPersistedMeals={day.orderedPersistedMeals}
              unconfirmedMessages={feed.unconfirmedMessages}
              isConfirming={feed.confirmMeal.isPending}
              onDeleteMeal={feed.handleDeleteMeal}
              onLogAgain={feed.handleLogAgain}
              onUpdateMeal={feed.handleUpdateMeal}
              onRefineMeal={REFINE_ENABLED ? feed.handleRefineMeal : undefined}
              onConfirmMeal={feed.handleConfirmMeal}
              onConfirmCheatMeal={feed.handleConfirmCheatMeal}
              onCheatClarify={feed.handleCheatClarify}
            />
          )}
        </div>

        <FeedComposer
          inputRef={feed.inputRef}
          isCheat={feed.isCheat}
          cheatOccasions={feed.recentCheatOccasions.data ?? []}
          cheatOccasionsDisabled={
            feed.isStagingRepeat || feed.stream.isAnalyzing
          }
          onSelectCheatOccasion={feed.handleRepeatCheat}
          relog={feed.relog}
          onSubmit={
            feed.loggingMode === 'manual'
              ? feed.handleManualSubmit
              : // Normal mode routes through one unified handler: it picks
                // text-only AI, pure-relog staging, or the combined merge based
                // on what's typed and staged. Cheat submits ride the same path
                // (no picks staged in cheat mode → straight to the estimator).
                feed.relog.handleNormalSubmit
          }
          onCancel={feed.handleCancel}
          disabled={feed.stream.isAnalyzing}
          mode={feed.loggingMode}
          onModeChange={feed.setLoggingMode}
          cheatIntensity={feed.cheatIntensity}
          onChangeIntensity={feed.setCheatIntensity}
          selectedDate={selectedDate}
          onBarcodeSuccess={feed.handleBarcodeSuccess}
        />
      </div>
    </main>
  );
}
