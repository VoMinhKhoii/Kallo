import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConfidenceDisplayState,
  NutrientCardData,
  NutrientTrend,
  NutritionOverview,
} from '@/lib/nutrition/types';
import { NutrientCard } from './nutrient-card';
import { NutrientGrid } from './nutrient-grid';
import { VitaminDCard } from './vitamin-d-card';

const { getFoodSourceCandidatesMock, getNutrientTrendMock } = vi.hoisted(
  () => ({
    getFoodSourceCandidatesMock: vi.fn(),
    getNutrientTrendMock: vi.fn(),
  })
);

vi.mock('@/lib/nutrition/actions', () => ({
  getFoodSourceCandidates: getFoodSourceCandidatesMock,
  getNutrientTrend: getNutrientTrendMock,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
  );
}

function createTrend(): NutrientTrend {
  return {
    nutrient: 'calciumMg',
    range: '30d',
    bucketTimezone: 'local',
    displayMode: 'line',
    points: [
      { date: '2026-04-01', value: 800, confidence: 80 },
      { date: '2026-04-02', value: 900, confidence: 90 },
    ],
  };
}

function createCard(
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
      mostConsistent: [],
      needsAttention: [],
      limitedDataCount: 0,
      macroConsistency: {
        averageConsistencyPct: 0,
        weakestMacro: null,
      },
    },
    macros: [],
    micronutrients: [createCard()],
    moreNutrients: [
      createCard({
        nutrient: 'sodiumMg',
        labelKey: 'nutrition.nutrients.sodium',
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

describe('NutrientCard', () => {
  beforeEach(() => {
    getFoodSourceCandidatesMock.mockResolvedValue({
      nutrient: 'calciumMg',
      candidates: [],
    });
    getNutrientTrendMock.mockResolvedValue(createTrend());
  });

  afterEach(() => {
    getFoodSourceCandidatesMock.mockReset();
    getNutrientTrendMock.mockReset();
  });

  it('does not fetch a trend until the card is expanded', async () => {
    const user = userEvent.setup();

    renderWithClient(
      <NutrientCard
        card={createCard()}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(screen.getByText('nutrition.nutrients.calcium')).toBeInTheDocument();
    expect(getNutrientTrendMock).not.toHaveBeenCalled();
    expect(getFoodSourceCandidatesMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'card.expand' }));

    expect(
      screen.getByRole('button', { name: 'card.collapse' })
    ).toHaveAttribute('aria-controls', 'nutrition-trend-calciumMg');
    await waitFor(() =>
      expect(getNutrientTrendMock).toHaveBeenCalledWith({
        nutrient: 'calciumMg',
        range: '30d',
        timezoneOffset: -420,
      })
    );
  });

  it('renders intake, target, source, confidence, context metrics, and caveats', () => {
    renderWithClient(
      <NutrientCard
        card={createCard({
          nutrient: 'sodiumMg',
          labelKey: 'nutrition.nutrients.sodium',
          averagePerDay: 1300,
          unit: 'mg',
          percentOfTarget: 57,
          target: 2300,
          displayState: 'limited_data',
          caveatKey: 'nutrition.caveats.sodium',
          contextMetrics: [
            {
              key: 'betaCaroteneMcg',
              labelKey: 'nutrition.nutrients.betaCarotene',
              averagePerDay: 4600,
              unit: 'mcg',
            },
          ],
        })}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(screen.getByText('nutrition.nutrients.sodium')).toBeInTheDocument();
    expect(screen.getByText(/1,300 mg/)).toBeInTheDocument();
    expect(screen.getByText(/57%/)).toBeInTheDocument();
    expect(screen.getByText(/2,300 mg/)).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.targetSources.vietnamRda')
    ).toBeInTheDocument();
    expect(screen.getByText('confidence.limitedData')).toBeInTheDocument();
    expect(screen.getByText('nutrition.caveats.sodium')).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.nutrients.betaCarotene')
    ).toBeInTheDocument();
  });

  it('loads food candidates separately from trend data', async () => {
    const user = userEvent.setup();

    renderWithClient(
      <NutrientCard
        card={createCard()}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    await waitFor(() =>
      expect(getFoodSourceCandidatesMock).toHaveBeenCalledWith({
        nutrient: 'calciumMg',
      })
    );
    expect(getNutrientTrendMock).not.toHaveBeenCalled();
  });

  it.each([
    ['normal', 'confidence.normal'],
    ['limited_data', 'confidence.limitedData'],
    ['warning_points', 'confidence.warningPoints'],
    ['insufficient_data', 'confidence.insufficientData'],
  ] satisfies [
    ConfidenceDisplayState,
    string,
  ][])('renders the %s confidence label', (displayState, label) => {
    renderWithClient(
      <NutrientCard
        card={createCard({ displayState })}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows limited-data copy instead of a target claim for insufficient data', () => {
    renderWithClient(
      <NutrientCard
        card={createCard({
          displayState: 'insufficient_data',
          percentOfTarget: null,
          target: null,
          targetSource: 'unsupported',
          targetSourceLabelKey: 'nutrition.targetSources.unsupported',
        })}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(screen.getByText('trend.insufficientData')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('uses point-mode language for warning-points cards', async () => {
    const user = userEvent.setup();
    getNutrientTrendMock.mockResolvedValue({
      ...createTrend(),
      displayMode: 'line',
    });

    renderWithClient(
      <NutrientCard
        card={createCard({ displayState: 'warning_points' })}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    await user.click(screen.getByRole('button', { name: 'card.expand' }));

    expect(await screen.findByText('trend.pointMode')).toBeInTheDocument();
    expect(screen.queryByText('trend.lineMode')).not.toBeInTheDocument();
  });

  it('renders trend error copy when an expanded card trend fails', async () => {
    const user = userEvent.setup();
    getNutrientTrendMock.mockRejectedValue(new Error('trend failed'));

    renderWithClient(
      <NutrientCard
        card={createCard()}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    await user.click(screen.getByRole('button', { name: 'card.expand' }));

    expect(await screen.findByText('trend.error')).toBeInTheDocument();
  });
});

describe('NutrientGrid', () => {
  beforeEach(() => {
    getNutrientTrendMock.mockResolvedValue(createTrend());
  });

  afterEach(() => {
    getNutrientTrendMock.mockReset();
  });

  it('does not mount more nutrient cards until the section is expanded', async () => {
    const user = userEvent.setup();

    renderWithClient(
      <NutrientGrid
        overview={createOverview()}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(screen.getByText('nutrition.nutrients.calcium')).toBeInTheDocument();
    expect(
      screen.queryByText('nutrition.nutrients.sodium')
    ).not.toBeInTheDocument();
    expect(getNutrientTrendMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'more.show' }));

    expect(screen.getByRole('button', { name: 'more.hide' })).toHaveAttribute(
      'aria-controls',
      'more-nutrients-panel'
    );
    expect(screen.getByText('nutrition.nutrients.sodium')).toBeInTheDocument();
    expect(getNutrientTrendMock).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: 'card.expand' })[1]);

    await waitFor(() =>
      expect(getNutrientTrendMock).toHaveBeenCalledWith({
        nutrient: 'sodiumMg',
        range: '30d',
        timezoneOffset: -420,
      })
    );
  });

  it('renders Vitamin D education copy', () => {
    renderWithClient(
      <NutrientGrid
        overview={createOverview()}
        resolvedRange="30d"
        timezoneOffset={-420}
      />
    );

    expect(
      screen.getByText('nutrition.education.vitaminD.title')
    ).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.education.vitaminD.body')
    ).toBeInTheDocument();
  });
});

describe('VitaminDCard', () => {
  it('renders education copy from i18n keys', () => {
    render(
      <VitaminDCard
        card={{
          id: 'vitamin_d',
          titleKey: 'nutrition.education.vitaminD.title',
          bodyKey: 'nutrition.education.vitaminD.body',
        }}
      />
    );

    expect(
      screen.getByText('nutrition.education.vitaminD.title')
    ).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.education.vitaminD.body')
    ).toBeInTheDocument();
  });
});
