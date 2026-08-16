import { fireEvent, render, screen, within } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import { FeedArea } from './feed-area';

vi.mock('@/components/logging/feed/macro-summary', () => ({
  MacroSummary: ({ totals }: { totals: { calories: number } }) => (
    <div data-testid="macro-summary" data-calories={totals.calories} />
  ),
}));

vi.mock('@/components/logging/feed/persisted/persisted-meal-card', () => ({
  PersistedMealCard: ({ meal }: { meal: { id: string } }) => (
    <div data-testid="persisted-meal-card">{meal.id}</div>
  ),
}));

vi.mock('@/components/logging/feed/meal-entry/meal-entry', () => ({
  MealEntry: ({
    message,
    onConfirm,
  }: {
    message: { userInput?: string; analysisId?: string };
    onConfirm?: (edits: unknown[]) => void;
  }) => (
    <div data-testid="meal-entry">
      {message.userInput}
      <button type="button" onClick={() => onConfirm?.([])}>
        confirm
      </button>
    </div>
  ),
}));

vi.mock('@/components/logging/feed/streaming/streaming-meal-entry', () => ({
  StreamingMealEntry: () => <div data-testid="streaming-meal-entry" />,
}));

vi.mock('@/components/logging/input/meal-input', () => ({
  MealInput: forwardRef(function MockMealInput(_props, ref) {
    useImperativeHandle(ref, () => ({
      getText: () => '',
      getManualLogging: () => ({ loggingMode: 'normal' }),
      clear: vi.fn(),
      focus: vi.fn(),
      setText: vi.fn(),
    }));

    return <div data-testid="meal-input" />;
  }),
}));

const {
  mockInvalidateQueries,
  mockMutate,
  mockUseLoggingDay,
  mockUseStreamAnalysis,
  mockUseStreamingTerminalEffects,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockMutate: vi.fn(),
  mockUseLoggingDay: vi.fn(),
  mockUseStreamAnalysis: vi.fn(),
  mockUseStreamingTerminalEffects: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  // The empty-day prompt reads the signed-in profile to greet by name; with no
  // provider in this tree the query just never resolves, which is the same
  // thing a cold load does and lands the name-less phrasing.
  useQuery: () => ({ data: undefined, isPending: true }),
}));

vi.mock('@/hooks/meals/use-logging-day', () => ({
  loggingDayKeys: {
    byUserDate: (userId: string, date: string) => ['logging-day', userId, date],
  },
  useLoggingDay: mockUseLoggingDay,
}));

vi.mock('@/hooks/meals/use-feed-submit', () => ({
  useFeedSubmit: () => ({ handleSubmit: vi.fn() }),
}));

vi.mock('@/hooks/meals/use-meal-mutations', () => ({
  useConfirmMeal: () => ({ mutate: mockMutate, isPending: false }),
  useUpdateMeal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveManualMeal: () => ({ mutate: vi.fn(), isPending: false }),
  useDuplicateMeal: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/meals/use-recent-cheat-occasions', () => ({
  useRecentCheatOccasions: () => ({ data: [] }),
}));

// Mocked at the hook level like the other composer hooks above, so this file
// keeps testing FeedArea's own behaviour rather than the relog picker's.
vi.mock('@/hooks/meals/relog/use-relog-composer', () => ({
  useRelogComposer: () => ({
    relogPicker: {
      isOpen: false,
      query: '',
      highlighted: 0,
      setHighlighted: vi.fn(),
      setOptions: vi.fn(),
      syncFromTextarea: vi.fn(),
      handleKeyDown: () => false,
      select: vi.fn(),
      close: vi.fn(),
    },
    relogCandidates: {
      dishes: [],
      meals: [],
      options: [],
      isLoading: false,
      isFetching: false,
    },
    relogStaged: {
      entries: [],
      totals: {
        caloriesKcal: null,
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
      },
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      isFull: false,
    },
    handleNormalSubmit: vi.fn(),
    hasStagedRelog: false,
  }),
}));

vi.mock('@/lib/actions/meals/cheat', () => ({
  stageCheatRepeatAction: vi.fn(),
}));

vi.mock('@/hooks/meals/use-stream-analysis', () => ({
  useStreamAnalysis: mockUseStreamAnalysis,
}));

vi.mock('@/hooks/meals/use-streaming-terminal-effects', () => ({
  useStreamingTerminalEffects: mockUseStreamingTerminalEffects,
}));

vi.mock('@/hooks/meals/use-submit-guard', () => ({
  useSubmitGuard: () => ({ guard: (fn: () => Promise<void>) => fn() }),
}));

const profile = {
  userId: 'user-123',
  goal: 'maintaining' as const,
  aggression: 0,
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 65,
};

const TODAY = '2026-05-31';

// A persisted meal with the four primary macros set (so the day is not flagged
// as "unknown macros") and a given calorie total.
function makeMeal(calories: number, id = 'meal-1') {
  const base = Object.fromEntries(NUTRITION_KEYS.map((key) => [key, null]));
  return {
    id,
    loggedAt: '2026-05-04T08:00:00.000Z',
    nutrition: {
      ...base,
      caloriesKcal: calories,
      proteinG: 20,
      carbohydrateG: 40,
      fatG: 10,
    },
  };
}

function dayWithMeals(meals: ReturnType<typeof makeMeal>[]) {
  mockUseLoggingDay.mockReturnValue({
    data: { persistedMeals: meals, pendingConfirmations: [] },
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  });
}

describe('FeedArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoggingDay.mockReturnValue({
      data: {
        persistedMeals: [],
        pendingConfirmations: [],
      },
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUseStreamAnalysis.mockReturnValue({
      status: 'idle',
      items: [],
      completedItems: [],
      result: null,
      analysisId: null,
      error: null,
      isAnalyzing: false,
      analyze: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('keeps macro summary and input outside the meal-card scroll region', () => {
    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    const macroRegion = screen.getByTestId('macro-summary-region');
    const scrollRegion = screen.getByTestId('meal-card-scroll');
    const input = screen.getByTestId('meal-input');

    expect(
      within(macroRegion).getByTestId('macro-summary')
    ).toBeInTheDocument();
    // On an empty day the input bar IS the centered empty state — no prompt.
    expect(within(scrollRegion).queryByTestId('macro-summary')).toBeNull();
    expect(within(scrollRegion).queryByTestId('meal-input')).toBeNull();
    expect(input).toBeInTheDocument();
  });

  it('feeds saved meal calories into the macro summary ring', () => {
    // The calorie ring reads its total from loggingDay.persistedMeals. The
    // first-meal regression left this at 0 after a save because the cache was
    // clobbered back to empty; assert the wiring sums the persisted meals so the
    // ring reflects the day once the confirmed meal is in the cache.
    dayWithMeals([makeMeal(450), makeMeal(300, 'meal-2')]);

    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByTestId('macro-summary')).toHaveAttribute(
      'data-calories',
      '750'
    );
  });

  it('renders server-backed pending confirmations in the card scroller', () => {
    mockUseLoggingDay.mockReturnValue({
      data: {
        persistedMeals: [],
        pendingConfirmations: [
          {
            id: 'pending-1',
            rawInput: 'Phở bò',
            loggedAt: '2026-05-04T05:30:00.000Z',
            parsedMeal: {
              mealName: 'Phở bò',
              items: [],
              totalMacros: {
                calories: 300,
                protein: 20,
                carbs: 40,
                fat: 8,
              },
            },
          },
        ],
      },
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    const scrollRegion = screen.getByTestId('meal-card-scroll');
    expect(within(scrollRegion).getByTestId('meal-entry')).toHaveTextContent(
      'Phở bò'
    );
    expect(within(scrollRegion).queryByTestId('empty-state')).toBeNull();
  });

  it('fires the confirm mutation for a server-loaded pending meal', () => {
    // Regression: pending cards from the server live in the query data, not the
    // local `messages` array. Confirming one must still dispatch the save —
    // previously the handler looked it up in `messages`, found nothing, and
    // silently returned (UI showed "saved" but nothing persisted).
    mockUseLoggingDay.mockReturnValue({
      data: {
        persistedMeals: [],
        pendingConfirmations: [
          {
            id: 'pending-1',
            rawInput: 'Phở bò',
            loggedAt: '2026-05-04T05:30:00.000Z',
            parsedMeal: {
              mealName: 'Phở bò',
              items: [],
              totalMacros: { calories: 300, protein: 20, carbs: 40, fat: 8 },
            },
          },
        ],
      },
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      analysisId: 'pending-1',
    });
  });

  it('shows a day loading skeleton instead of stale or empty card content', () => {
    mockUseLoggingDay.mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: false,
      isLoading: true,
      refetch: vi.fn(),
    });

    render(
      <FeedArea
        selectedDate="2026-05-05"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    const scrollRegion = screen.getByTestId('meal-card-scroll');
    expect(
      within(scrollRegion).getByTestId('logging-day-skeleton')
    ).toBeInTheDocument();
    expect(within(scrollRegion).queryByTestId('empty-state')).toBeNull();
    expect(
      within(scrollRegion).queryByTestId('persisted-meal-card')
    ).toBeNull();
  });

  it('shows a retryable error state instead of an empty state when day loading fails', async () => {
    const refetch = vi.fn();

    mockUseLoggingDay.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch,
    });

    render(
      <FeedArea
        selectedDate="2026-05-05"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    const scrollRegion = screen.getByTestId('meal-card-scroll');
    expect(within(scrollRegion).getByRole('alert')).toHaveTextContent(
      'loadErrorTitle'
    );
    expect(within(scrollRegion).queryByTestId('empty-state')).toBeNull();

    await screen.getByRole('button', { name: /retryDay/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('disables day retry while refetching after an error', () => {
    mockUseLoggingDay.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <FeedArea
        selectedDate="2026-05-05"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retryDay/i });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the in-context partial-day notice on a past under-logged day', () => {
    dayWithMeals([makeMeal(400)]); // 400 < 50% of the 2000 target

    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    // The notice (role="status") shows; it has no "open" action — that belongs
    // to the proactive yesterday prompt, which does not render on a past day.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'open' })).toBeNull();
  });

  it('does not show the in-context notice on a past day at/above target', () => {
    dayWithMeals([makeMeal(1800)]);

    render(
      <FeedArea
        selectedDate="2026-05-04"
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the yesterday prompt on today and hides it after dismiss', () => {
    dayWithMeals([makeMeal(400)]);

    render(
      <FeedArea
        selectedDate={TODAY}
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'open' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(screen.queryByRole('button', { name: 'open' })).toBeNull();
  });

  it('marks the day stale without a racing refetch when analysis completes', () => {
    render(
      <FeedArea
        selectedDate={TODAY}
        today={TODAY}
        profile={profile}
        onSelectDate={vi.fn()}
      />
    );

    // Invoke the onAnalysisComplete callback the feed wires into the streaming
    // terminal effects. It must NOT trigger a background refetch (refetchType:
    // 'none') — that pre-save refetch could otherwise clobber a just-confirmed
    // meal and strand the calorie ring on the stale value.
    const config = mockUseStreamingTerminalEffects.mock.calls.at(-1)?.[0];
    expect(config?.onAnalysisComplete).toBeTypeOf('function');
    config.onAnalysisComplete();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['logging-day', profile.userId, TODAY],
      refetchType: 'none',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['meal-dates'],
    });
  });

  describe('the first paint, before the day query answers', () => {
    /** The day query still in flight — the state the first paint has to survive. */
    function dayIsLoading() {
      mockUseLoggingDay.mockReturnValue({
        data: undefined,
        isError: false,
        isFetching: true,
        isLoading: true,
        refetch: vi.fn(),
      });
    }

    function renderFeed(initiallyHasEntries?: boolean) {
      return render(
        <FeedArea
          selectedDate="2026-05-04"
          today={TODAY}
          profile={profile}
          onSelectDate={vi.fn()}
          initiallyHasEntries={initiallyHasEntries}
        />
      );
    }

    it('opens on the empty layout when the server says the day is empty', () => {
      dayIsLoading();
      renderFeed(false);

      // The composer belongs in the middle of an empty day, and the empty-day
      // question above it is the tell that it is there. Without the server's
      // answer the client assumed the day had meals, docked the composer, and
      // then slid it up the screen once the query landed.
      expect(screen.getByRole('paragraph')).toBeInTheDocument();
      // And no ghost cards for a day we have already been told holds nothing.
      expect(
        screen.queryByTestId('logging-day-skeleton')
      ).not.toBeInTheDocument();
    });

    it('opens on the populated layout when the server says the day has meals', () => {
      dayIsLoading();
      renderFeed(true);

      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
      expect(screen.getByTestId('logging-day-skeleton')).toBeInTheDocument();
    });

    it('falls back to the old assumption when the server could not answer', () => {
      // A first-ever visit: no timezone cookie yet, so there is no honest
      // answer to give and the client does what it always did.
      dayIsLoading();
      renderFeed(undefined);

      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
      expect(screen.getByTestId('logging-day-skeleton')).toBeInTheDocument();
    });
  });
});
