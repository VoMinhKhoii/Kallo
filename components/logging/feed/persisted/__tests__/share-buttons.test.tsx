import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MutateCallbacks {
  onSuccess: () => void;
  onError: () => void;
}

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/social/sharing/use-share-meal', () => ({
  useShareMeal: () => ({ isPending: false, mutate: mocks.mutate }),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { ShareToCircleButton } from '../share-buttons';

const SHARED = { shareId: 'share-1', visibility: 'circle' };

/** Settles every mutation through one of its callbacks, as the server would. */
function settleWith(outcome: keyof MutateCallbacks) {
  mocks.mutate.mockImplementation(
    (_input: unknown, callbacks: MutateCallbacks) => callbacks[outcome]()
  );
}

describe('ShareToCircleButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the circle toggle for a shared meal', () => {
    render(<ShareToCircleButton mealId="meal-1" share={SHARED} />);

    // A "Share card" link used to sit beside it. It pointed at the macro-card
    // image, which renders only for a signed-in viewer in the sharer's circle,
    // so the people it was sent to got a JSON error instead.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('shared');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('unshares a shared meal and confirms it with a toast', async () => {
    const user = userEvent.setup();
    settleWith('onSuccess');
    render(<ShareToCircleButton mealId="meal-1" share={SHARED} />);

    await user.click(screen.getByRole('button', { name: 'shared' }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { mealId: 'meal-1', visibility: 'private' },
      expect.anything()
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('unsharedToast');
    expect(screen.getByRole('button', { name: 'share' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('stays unshared and says so when sharing fails', async () => {
    const user = userEvent.setup();
    settleWith('onError');
    render(<ShareToCircleButton mealId="meal-1" share={null} />);

    await user.click(screen.getByRole('button', { name: 'share' }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { mealId: 'meal-1', visibility: 'circle' },
      expect.anything()
    );
    expect(mocks.toastError).toHaveBeenCalledWith('errorShare');
    expect(screen.getByRole('button', { name: 'share' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
