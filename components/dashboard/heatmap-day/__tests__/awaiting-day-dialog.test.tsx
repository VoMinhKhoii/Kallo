import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMealsByDate: vi.fn(),
  markDayComplete: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/domain/meals/meals-client', () => ({
  fetchMealsByDate: mocks.fetchMealsByDate,
}));
vi.mock('@/lib/actions/meals/day/mark-day-complete', () => ({
  markDayCompleteAction: mocks.markDayComplete,
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AwaitingDayDialog } from '../awaiting-day-dialog';

const DATE = '2026-10-20';

function meal(
  id: string,
  rawInput: string,
  loggedAt: string,
  kcal: number,
  grams: { protein: number; fat: number }
) {
  return {
    id,
    rawInput,
    loggedAt,
    nutrition: {
      caloriesKcal: kcal,
      proteinG: grams.protein,
      // Never measured — the total says so rather than a confident zero.
      carbohydrateG: null,
      fatG: grams.fat,
    },
  };
}

function renderDialog(isToday = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(
    <AwaitingDayDialog
      open
      onOpenChange={onOpenChange}
      userId="user-1"
      date={DATE}
      calories={900}
      isToday={isToday}
    />,
    { wrapper }
  );
  return { onOpenChange };
}

describe('AwaitingDayDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The server answers newest first.
    mocks.fetchMealsByDate.mockResolvedValue([
      meal('m2', 'cơm tấm', '2026-10-20T12:00:00.000Z', 600, {
        protein: 20.4,
        fat: 10,
      }),
      meal('m1', 'phở bò', '2026-10-20T01:00:00.000Z', 300, {
        protein: 15.3,
        fat: 4.4,
      }),
    ]);
    mocks.markDayComplete.mockResolvedValue({
      success: true,
      markedComplete: true,
    });
  });

  it('titles the dialog with the day and lists its meals in eating order', async () => {
    renderDialog();

    expect(screen.getByText('Tuesday, October 20')).toBeInTheDocument();
    const first = await screen.findByText('Phở bò');
    const second = screen.getByText('Cơm tấm');
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(mocks.fetchMealsByDate).toHaveBeenCalledWith(
      expect.objectContaining({ date: DATE })
    );
  });

  it('totals the day on one line: macros, then kcal', async () => {
    renderDialog();

    const total = await screen.findByTestId('awaiting-day-total');
    // Label (the key, under the test's translator), macros, then kcal. No meal
    // measured carbs: a dash, not a confident zero.
    expect(total).toHaveTextContent('totalP: 35.7gC: —F: 14.4g900 kcal');
  });

  it('asks before marking the day, then marks it and closes', async () => {
    const { onOpenChange } = renderDialog();
    await screen.findByText('Phở bò');

    await userEvent.click(
      screen.getByRole('button', { name: 'confirmAccept' })
    );
    // The mark is one-way: the same "are you sure?" the logging feed asks.
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByText('confirmTitle')).toBeInTheDocument();
    expect(mocks.markDayComplete).not.toHaveBeenCalled();

    await userEvent.click(
      within(ask).getByRole('button', { name: 'confirmAccept' })
    );

    await waitFor(() =>
      expect(mocks.markDayComplete).toHaveBeenCalledWith(
        expect.objectContaining({ date: DATE })
      )
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('cancelling the ask marks nothing', async () => {
    renderDialog();
    await screen.findByText('Phở bò');

    await userEvent.click(
      screen.getByRole('button', { name: 'confirmAccept' })
    );
    const ask = await screen.findByRole('alertdialog');
    await userEvent.click(
      within(ask).getByRole('button', { name: 'confirmCancel' })
    );

    expect(mocks.markDayComplete).not.toHaveBeenCalled();
  });

  it('opens the logging page on that day to add a missed meal', async () => {
    const { onOpenChange } = renderDialog();
    await screen.findByText('Phở bò');

    await userEvent.click(screen.getByRole('button', { name: 'addMissed' }));

    expect(mocks.push).toHaveBeenCalledWith(`/logging?date=${DATE}`);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lets today be reviewed but not confirmed', async () => {
    renderDialog(true);
    await screen.findByText('Phở bò');

    expect(screen.getByText('todayNote')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'confirmAccept' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'addMissed' })
    ).toBeInTheDocument();
  });
});
