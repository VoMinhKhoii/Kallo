import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadMealsByDate: vi.fn(),
  markDayComplete: vi.fn(),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/actions/meals/load-meals', () => ({
  loadMealsByDate: mocks.loadMealsByDate,
}));
vi.mock('@/lib/actions/meals/day/mark-day-complete', () => ({
  markDayCompleteAction: mocks.markDayComplete,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AwaitingDayDialog } from '../awaiting-day-dialog';

const DATE = '2026-10-20';

function meal(id: string, rawInput: string, loggedAt: string, kcal: number) {
  return {
    id,
    rawInput,
    loggedAt,
    nutrition: {
      caloriesKcal: kcal,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
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
      calorieTarget={2000}
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
    mocks.loadMealsByDate.mockResolvedValue([
      meal('m2', 'cơm tấm', '2026-10-20T12:00:00.000Z', 600),
      meal('m1', 'phở bò', '2026-10-20T01:00:00.000Z', 300),
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
    expect(mocks.loadMealsByDate).toHaveBeenCalledWith(
      expect.objectContaining({ date: DATE })
    );
  });

  it('marks the day complete from the dialog and then closes it', async () => {
    const { onOpenChange } = renderDialog();
    await screen.findByText('Phở bò');

    await userEvent.click(
      screen.getByRole('button', { name: 'confirmAccept' })
    );

    await waitFor(() =>
      expect(mocks.markDayComplete).toHaveBeenCalledWith(
        expect.objectContaining({ date: DATE })
      )
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('lets today be reviewed but not confirmed', async () => {
    renderDialog(true);
    await screen.findByText('Phở bò');

    expect(screen.getByText('todayNote')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'confirmAccept' })
    ).not.toBeInTheDocument();
  });
});
