import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemindersRow } from '../reminders-row';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setMealReminders: vi.fn(),
}));

vi.mock('@/lib/actions/notifications/reminder-preferences', () => ({
  setMealReminders: mocks.setMealReminders,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('RemindersRow', () => {
  it('turns reminders off and refreshes the profile it was seeded from', async () => {
    mocks.setMealReminders.mockResolvedValue({ mealReminders: false });
    render(<RemindersRow initialValue />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.setMealReminders).toHaveBeenCalledWith(false);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('rolls back when the save fails', async () => {
    mocks.setMealReminders.mockRejectedValue(new Error('offline'));
    render(<RemindersRow initialValue />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    );
  });
});
