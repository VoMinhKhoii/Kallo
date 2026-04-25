import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NutrientCardData,
  NutritionOverview,
} from '@/lib/nutrition/types';
import { NutritionShell } from './nutrition-shell';

const {
  getFoodSourceCandidatesMock,
  getNutritionOverviewMock,
  getNutrientTrendMock,
} = vi.hoisted(() => ({
  getFoodSourceCandidatesMock: vi.fn(),
  getNutritionOverviewMock: vi.fn(),
  getNutrientTrendMock: vi.fn(),
}));

vi.mock('@/lib/nutrition/actions', () => ({
  getFoodSourceCandidates: getFoodSourceCandidatesMock,
  getNutritionOverview: getNutritionOverviewMock,
  getNutrientTrend: getNutrientTrendMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

function createNutrientCard(
  overrides: Partial<NutrientCardData> = {}
): NutrientCardData {
  return {
    nutrient: 'calciumMg',
    labelKey: 'nutrition.nutrients.calcium',
    group: 'mineral',
    averagePerDay: 820,
    target: 1000,
    targetSource: 'vietnam_rda',
    targetSourceLabelKey: 'nutrition.targetSources.vietnamRda',
    unit: 'mg',
    percentOfTarget: 82,
    confidence: 91,
    displayState: 'normal',
    supportsCandidates: true,
    ...overrides,
  };
}

function createOverview(
  overrides: Partial<NutritionOverview> = {}
): NutritionOverview {
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
    micronutrients: [createNutrientCard()],
    moreNutrients: [
      createNutrientCard({
        nutrient: 'vitaminCMg',
        labelKey: 'nutrition.nutrients.vitaminC',
        averagePerDay: 64,
        target: 75,
        percentOfTarget: 85,
        confidence: 81,
        group: 'vitamin',
        unit: 'mg',
      }),
    ],
    educationCards: [
      {
        id: 'vitamin_d',
        titleKey: 'nutrition.education.vitaminD.title',
        bodyKey: 'nutrition.education.vitaminD.body',
      },
    ],
    ...overrides,
  };
}

function createQueryClient({
  retry = false,
  retryDelay,
}: {
  retry?: boolean | number;
  retryDelay?: number;
} = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry,
        retryDelay,
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
    getFoodSourceCandidatesMock.mockResolvedValue({
      nutrient: 'calciumMg',
      candidates: [],
    });
    getNutritionOverviewMock.mockResolvedValue(createOverview());
    getNutrientTrendMock.mockResolvedValue({ points: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    getFoodSourceCandidatesMock.mockReset();
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
    expect(
      screen.getAllByText('nutrition.nutrients.calcium').length
    ).toBeGreaterThan(0);
    expect(screen.getByText('nutrition.macros.calories')).toBeInTheDocument();
    expect(screen.getByText('nutrition.macros.protein')).toBeInTheDocument();
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
    expect(screen.getByTestId('macro-pattern-section')).not.toContainElement(
      screen.queryByRole('progressbar')
    );
  });

  it('links no-meals empty state to logging', async () => {
    getNutritionOverviewMock.mockResolvedValue(
      createOverview({
        loggedDays: 0,
        loggedDaysLast30: 0,
      })
    );
    const queryClient = createQueryClient();

    renderShell(queryClient);

    expect(await screen.findByText('empty.title')).toBeInTheDocument();
    expect(screen.getByText('empty.description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'empty.logMeal' })).toHaveAttribute(
      'href',
      '/logging'
    );
  });

  it('keeps averages and cards visible when there are too few days for trends', async () => {
    getNutritionOverviewMock.mockResolvedValue(
      createOverview({
        trendStatus: 'too_few_logged_days',
      })
    );
    const queryClient = createQueryClient();

    renderShell(queryClient);

    expect(await screen.findByText('trends.tooFewDays')).toBeInTheDocument();
    expect(screen.getByText('nutrition.macros.calories')).toBeInTheDocument();
    expect(
      screen.getAllByText('nutrition.nutrients.calcium').length
    ).toBeGreaterThan(0);
  });

  it('renders the complete nutrient composition and passes resolved range to cards', async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();

    renderShell(queryClient);

    await waitFor(() =>
      expect(
        screen.getAllByText('nutrition.nutrients.calcium').length
      ).toBeGreaterThan(0)
    );
    expect(
      screen.getByText('nutrition.education.vitaminD.title')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'candidates.open' })
    ).toBeInTheDocument();

    expect(
      screen.queryByText('nutrition.nutrients.vitaminC')
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'more.show' }));
    expect(
      screen.getByText('nutrition.nutrients.vitaminC')
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'card.expand' })[0]);
    await waitFor(() =>
      expect(getNutrientTrendMock).toHaveBeenCalledWith({
        nutrient: 'calciumMg',
        range: '30d',
        timezoneOffset: -420,
      })
    );
  });

  it('renders inline errors with retry and sends a toast on overview errors', async () => {
    const user = userEvent.setup();
    getNutritionOverviewMock
      .mockRejectedValueOnce(new Error('overview failed'))
      .mockResolvedValueOnce(createOverview());
    const queryClient = createQueryClient({ retry: 3, retryDelay: 0 });

    renderShell(queryClient);

    expect(await screen.findByText('errors.overview')).toBeInTheDocument();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('errors.overview')
    );
    expect(getNutritionOverviewMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'errors.retry' }));

    expect(
      await screen.findByText('summary.mostConsistent')
    ).toBeInTheDocument();
    expect(getNutritionOverviewMock).toHaveBeenCalledTimes(2);
  });
});
