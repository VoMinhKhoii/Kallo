import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NutritionOverview } from '@/lib/nutrition/types';
import { NutritionShell } from './nutrition-shell';

const { getNutritionOverviewMock, getNutrientTrendMock } = vi.hoisted(() => ({
  getNutritionOverviewMock: vi.fn(),
  getNutrientTrendMock: vi.fn(),
}));

vi.mock('@/lib/nutrition/actions', () => ({
  getNutritionOverview: getNutritionOverviewMock,
  getNutrientTrend: getNutrientTrendMock,
}));

function createOverview(): NutritionOverview {
  return {
    requestedRange: 'auto',
    resolvedRange: '30d',
    bucketTimezone: 'local',
    loggedDays: 12,
    loggedDaysLast30: 12,
    trendStatus: 'ready',
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    summary: {
      mostConsistent: [
        {
          nutrient: 'calciumMg',
          labelKey: 'nutrition.nutrients.calcium',
          average: 820,
          unit: 'mg',
          percentOfTarget: 82,
          confidence: 91,
          status: 'adequate',
          applicability: 'scored',
        },
      ],
      needsAttention: [
        {
          nutrient: 'ironMg',
          labelKey: 'nutrition.nutrients.iron',
          average: 7,
          unit: 'mg',
          percentOfTarget: 44,
          confidence: 81,
          status: 'below_target',
          applicability: 'scored',
        },
      ],
      limitedDataCount: 3,
      macroConsistency: {
        averageConsistencyPct: 72,
        weakestMacro: 'protein',
      },
    },
    macros: [
      {
        key: 'calories',
        labelKey: 'nutrition.macros.calories',
        averagePerDay: 2000,
        target: 2100,
        unit: 'kcal',
        consistencyPct: 88,
      },
      {
        key: 'protein',
        labelKey: 'nutrition.macros.protein',
        averagePerDay: 98,
        target: 120,
        unit: 'g',
        consistencyPct: 61,
      },
      {
        key: 'carbohydrate',
        labelKey: 'nutrition.macros.carbohydrate',
        averagePerDay: 245,
        target: 260,
        unit: 'g',
        consistencyPct: 77,
      },
      {
        key: 'fat',
        labelKey: 'nutrition.macros.fat',
        averagePerDay: 64,
        target: 70,
        unit: 'g',
        consistencyPct: 70,
      },
      {
        key: 'fiber',
        labelKey: 'nutrition.macros.fiber',
        averagePerDay: 18,
        target: null,
        unit: 'g',
        consistencyPct: null,
      },
    ],
    micronutrients: [],
    moreNutrients: [],
    educationCards: [],
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderShell(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NutritionShell />
    </QueryClientProvider>
  );
}

describe('NutritionShell', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
    getNutritionOverviewMock.mockResolvedValue(createOverview());
    getNutrientTrendMock.mockResolvedValue({ points: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getNutritionOverviewMock.mockReset();
    getNutrientTrendMock.mockReset();
  });

  it('loads the auto overview with a timezone-aware query key and no trend request', async () => {
    const queryClient = createQueryClient();

    renderShell(queryClient);

    await waitFor(() =>
      expect(getNutritionOverviewMock).toHaveBeenCalledWith({
        range: 'auto',
        timezoneOffset: -420,
      })
    );

    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ['nutrition', 'overview', 'auto', -420] })
    ).toBeTruthy();
    expect(getNutrientTrendMock).not.toHaveBeenCalled();
  });

  it('updates the overview request when a user chooses an explicit range', async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();

    renderShell(queryClient);

    await screen.findByText('summary.mostConsistent');

    await user.click(screen.getByRole('button', { name: '7d' }));
    await waitFor(() =>
      expect(getNutritionOverviewMock).toHaveBeenLastCalledWith({
        range: '7d',
        timezoneOffset: -420,
      })
    );

    await user.click(screen.getByRole('button', { name: '30d' }));
    await waitFor(() =>
      expect(getNutritionOverviewMock).toHaveBeenLastCalledWith({
        range: '30d',
        timezoneOffset: -420,
      })
    );

    await user.click(screen.getByRole('button', { name: '90d' }));
    await waitFor(() =>
      expect(getNutritionOverviewMock).toHaveBeenLastCalledWith({
        range: '90d',
        timezoneOffset: -420,
      })
    );
  });

  it('renders summary cards and macro period averages without daily bars', async () => {
    const queryClient = createQueryClient();

    renderShell(queryClient);

    expect(
      await screen.findByText('summary.mostConsistent')
    ).toBeInTheDocument();
    expect(screen.getByText('summary.needsAttention')).toBeInTheDocument();
    expect(screen.getByText('summary.limitedData')).toBeInTheDocument();
    expect(screen.getByText('summary.macroConsistency')).toBeInTheDocument();
    expect(screen.getByText('nutrition.nutrients.calcium')).toBeInTheDocument();
    expect(screen.getByText('nutrition.nutrients.iron')).toBeInTheDocument();
    expect(screen.getByText('nutrition.macros.calories')).toBeInTheDocument();
    expect(screen.getByText('nutrition.macros.protein')).toBeInTheDocument();
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
    expect(screen.getByTestId('macro-pattern-section')).not.toContainElement(
      screen.queryByRole('progressbar')
    );
  });
});
