import { render, screen, within } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedArea } from './feed-area';

vi.mock('@/components/logging/feed/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('@/components/logging/feed/macro-summary', () => ({
  MacroSummary: () => <div data-testid="macro-summary" />,
}));

vi.mock('@/components/logging/feed/persisted-meal-card', () => ({
  PersistedMealCard: ({ meal }: { meal: { id: string } }) => (
    <div data-testid="persisted-meal-card">{meal.id}</div>
  ),
}));

vi.mock('@/components/logging/feed/meal-entry', () => ({
  MealEntry: ({
    message,
  }: {
    message: { userInput?: string; analysisId?: string };
  }) => <div data-testid="meal-entry">{message.userInput}</div>,
}));

vi.mock('@/components/logging/feed/streaming-meal-entry', () => ({
  StreamingMealEntry: () => <div data-testid="streaming-meal-entry" />,
}));

vi.mock('@/components/logging/input/meal-input', () => ({
  MealInput: forwardRef(function MockMealInput(_props, ref) {
    useImperativeHandle(ref, () => ({
      getText: () => '',
      clear: vi.fn(),
      focus: vi.fn(),
      setText: vi.fn(),
    }));

    return <div data-testid="meal-input" />;
  }),
}));

const { mockInvalidateQueries, mockUseLoggingDay, mockUseStreamAnalysis } =
  vi.hoisted(() => ({
    mockInvalidateQueries: vi.fn(),
    mockUseLoggingDay: vi.fn(),
    mockUseStreamAnalysis: vi.fn(),
  }));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('@/hooks/use-logging-day', () => ({
  loggingDayKeys: {
    byUserDate: (userId: string, date: string) => ['logging-day', userId, date],
  },
  useLoggingDay: mockUseLoggingDay,
}));

vi.mock('@/hooks/use-feed-submit', () => ({
  useFeedSubmit: () => ({ handleSubmit: vi.fn() }),
}));

vi.mock('@/hooks/use-meal-mutations', () => ({
  useConfirmMeal: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/use-stream-analysis', () => ({
  useStreamAnalysis: mockUseStreamAnalysis,
}));

vi.mock('@/hooks/use-streaming-terminal-effects', () => ({
  useStreamingTerminalEffects: vi.fn(),
}));

vi.mock('@/hooks/use-submit-guard', () => ({
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

describe('FeedArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoggingDay.mockReturnValue({
      data: {
        persistedMeals: [],
        pendingConfirmations: [],
      },
      isLoading: false,
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
    render(<FeedArea selectedDate="2026-05-04" profile={profile} />);

    const macroRegion = screen.getByTestId('macro-summary-region');
    const scrollRegion = screen.getByTestId('meal-card-scroll');
    const input = screen.getByTestId('meal-input');

    expect(
      within(macroRegion).getByTestId('macro-summary')
    ).toBeInTheDocument();
    expect(within(scrollRegion).getByTestId('empty-state')).toBeInTheDocument();
    expect(within(scrollRegion).queryByTestId('macro-summary')).toBeNull();
    expect(within(scrollRegion).queryByTestId('meal-input')).toBeNull();
    expect(input).toBeInTheDocument();
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
      isLoading: false,
    });

    render(<FeedArea selectedDate="2026-05-04" profile={profile} />);

    const scrollRegion = screen.getByTestId('meal-card-scroll');
    expect(within(scrollRegion).getByTestId('meal-entry')).toHaveTextContent(
      'Phở bò'
    );
    expect(within(scrollRegion).queryByTestId('empty-state')).toBeNull();
  });

  it('shows a day loading skeleton instead of stale or empty card content', () => {
    mockUseLoggingDay.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<FeedArea selectedDate="2026-05-05" profile={profile} />);

    const scrollRegion = screen.getByTestId('meal-card-scroll');
    expect(
      within(scrollRegion).getByTestId('logging-day-skeleton')
    ).toBeInTheDocument();
    expect(within(scrollRegion).queryByTestId('empty-state')).toBeNull();
    expect(
      within(scrollRegion).queryByTestId('persisted-meal-card')
    ).toBeNull();
  });
});
