import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURATED_FOOD_SOURCE_CANDIDATES,
  type FoodSourceCandidate,
} from '@/lib/nutrition/food-source-candidates';
import type { NutrientCardData } from '@/lib/nutrition/types';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';
import { FoodSourceCandidatesPanel } from './food-source-candidates-panel';

const { getFoodSourceCandidatesMock } = vi.hoisted(() => ({
  getFoodSourceCandidatesMock: vi.fn(),
}));

vi.mock('@/lib/nutrition/actions', () => ({
  getFoodSourceCandidates: getFoodSourceCandidatesMock,
}));

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

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
  );
}

function createCard(
  overrides: Partial<NutrientCardData> = {}
): NutrientCardData {
  return {
    nutrient: 'ironMg',
    labelKey: 'nutrition.nutrients.iron',
    group: 'mineral',
    averagePerDay: 8,
    target: 18,
    targetSource: 'vietnam_rda',
    targetSourceLabelKey: 'nutrition.targetSources.vietnamRda',
    unit: 'mg',
    percentOfTarget: 44,
    confidence: 81,
    displayState: 'normal',
    supportsCandidates: true,
    ...overrides,
  };
}

function getMessageValue(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, messages);
}

function expectLocalizedCandidateKey(
  messages: unknown,
  candidate: FoodSourceCandidate,
  key: keyof Pick<
    FoodSourceCandidate,
    'nameKey' | 'servingKey' | 'rationaleKey' | 'cautionKey'
  >
) {
  const messageKey = candidate[key];
  if (!messageKey) return;

  expect(getMessageValue(messages, messageKey)).toEqual(expect.any(String));
  expect(
    (getMessageValue(messages, messageKey) as string).trim().length
  ).toBeGreaterThan(0);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe('FoodSourceCandidatesPanel', () => {
  beforeEach(() => {
    getFoodSourceCandidatesMock.mockResolvedValue({
      nutrient: 'ironMg',
      candidates: [
        {
          nutrient: 'ironMg',
          id: 'leanBeef',
          nameKey: 'nutrition.candidates.ironMg.leanBeef.name',
          servingKey: 'nutrition.candidates.ironMg.leanBeef.serving',
          rationaleKey: 'nutrition.candidates.ironMg.leanBeef.rationale',
        },
      ],
    });
  });

  afterEach(() => {
    getFoodSourceCandidatesMock.mockReset();
  });

  it('does not query candidates before the panel is opened', () => {
    renderWithClient(<FoodSourceCandidatesPanel card={createCard()} />);

    expect(
      screen.getByRole('button', { name: 'candidates.open' })
    ).toBeInTheDocument();
    expect(getFoodSourceCandidatesMock).not.toHaveBeenCalled();
  });

  it('queries supported below-target nutrients with enough confidence when opened', async () => {
    const user = userEvent.setup();

    renderWithClient(<FoodSourceCandidatesPanel card={createCard()} />);

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    await waitFor(() =>
      expect(getFoodSourceCandidatesMock).toHaveBeenCalledWith({
        nutrient: 'ironMg',
      })
    );
    expect(screen.getByText('candidates.title')).toBeInTheDocument();
    expect(screen.getByText('candidates.description')).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.candidates.ironMg.leanBeef.name')
    ).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.candidates.ironMg.leanBeef.serving')
    ).toBeInTheDocument();
    expect(
      screen.getByText('nutrition.candidates.ironMg.leanBeef.rationale')
    ).toBeInTheDocument();
  });

  it('shows retry copy when candidate loading fails', async () => {
    const user = userEvent.setup();
    getFoodSourceCandidatesMock.mockRejectedValue(
      new Error('candidate failed')
    );

    renderWithClient(<FoodSourceCandidatesPanel card={createCard()} />);

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    expect(await screen.findByText('candidates.error')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'candidates.retry' })
    ).toBeInTheDocument();
  });

  it('does not auto-retry failed candidate requests', async () => {
    const user = userEvent.setup();
    getFoodSourceCandidatesMock.mockRejectedValue(
      new Error('candidate failed')
    );

    render(
      <QueryClientProvider
        client={createQueryClient({ retry: 3, retryDelay: 0 })}
      >
        <FoodSourceCandidatesPanel card={createCard()} />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    expect(await screen.findByText('candidates.error')).toBeInTheDocument();
    expect(getFoodSourceCandidatesMock).toHaveBeenCalledTimes(1);
  });

  it('guards the retry button while a retry is in flight', async () => {
    const user = userEvent.setup();
    const retry = createDeferred<unknown>();
    getFoodSourceCandidatesMock
      .mockRejectedValueOnce(new Error('candidate failed'))
      .mockReturnValueOnce(retry.promise);

    renderWithClient(<FoodSourceCandidatesPanel card={createCard()} />);

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    const retryButton = await screen.findByRole('button', {
      name: 'candidates.retry',
    });
    await user.click(retryButton);

    await waitFor(() => expect(retryButton).toBeDisabled());
    expect(retryButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('candidates.loading')).toBeInTheDocument();

    retry.resolve({
      nutrient: 'ironMg',
      candidates: [],
    });
    expect(await screen.findByText('candidates.empty')).toBeInTheDocument();
  });

  it('renders an empty state when no curated foods are returned', async () => {
    const user = userEvent.setup();
    getFoodSourceCandidatesMock.mockResolvedValue({
      nutrient: 'ironMg',
      candidates: [],
    });

    renderWithClient(<FoodSourceCandidatesPanel card={createCard()} />);

    await user.click(screen.getByRole('button', { name: 'candidates.open' }));

    expect(await screen.findByText('candidates.empty')).toBeInTheDocument();
  });

  it('is hidden for unsupported or low-confidence nutrients', () => {
    const { rerender } = renderWithClient(
      <FoodSourceCandidatesPanel
        card={createCard({
          nutrient: 'sodiumMg',
          labelKey: 'nutrition.nutrients.sodium',
          supportsCandidates: false,
        })}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'candidates.open' })
    ).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <FoodSourceCandidatesPanel card={createCard({ confidence: 39 })} />
      </QueryClientProvider>
    );

    expect(
      screen.queryByRole('button', { name: 'candidates.open' })
    ).not.toBeInTheDocument();
    expect(getFoodSourceCandidatesMock).not.toHaveBeenCalled();
  });

  it('uses foods-to-consider copy and avoids prescriptions', () => {
    expect(enMessages.nutrition.candidates.description).toContain(
      'foods to consider'
    );
    expect(enMessages.nutrition.candidates.description).toContain(
      'not prescriptions'
    );
    expect(enMessages.nutrition.candidates.description).not.toMatch(
      /must eat|should take|treats|cures/i
    );
  });

  it('has complete English and Vietnamese candidate copy', () => {
    const candidates = Object.values(CURATED_FOOD_SOURCE_CANDIDATES).flat();

    for (const candidate of candidates) {
      expectLocalizedCandidateKey(enMessages, candidate, 'nameKey');
      expectLocalizedCandidateKey(enMessages, candidate, 'servingKey');
      expectLocalizedCandidateKey(enMessages, candidate, 'rationaleKey');
      expectLocalizedCandidateKey(enMessages, candidate, 'cautionKey');
      expectLocalizedCandidateKey(viMessages, candidate, 'nameKey');
      expectLocalizedCandidateKey(viMessages, candidate, 'servingKey');
      expectLocalizedCandidateKey(viMessages, candidate, 'rationaleKey');
      expectLocalizedCandidateKey(viMessages, candidate, 'cautionKey');
    }
  });
});
