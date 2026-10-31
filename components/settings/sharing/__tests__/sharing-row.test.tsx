import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SharingRow } from '../sharing-row';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@/lib/actions/visibility/sharing-preferences', () => ({
  setAutoShareToCircle: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

describe('SharingRow', () => {
  // The value can change elsewhere (another device, the app) and arrive as a
  // new prop rather than a fresh mount.
  it('adopts a new server value while it stays mounted', () => {
    const view = render(<SharingRow initialValue={false} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    view.rerender(<SharingRow initialValue={true} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  // The row remounts from the shell's profile whenever its settings page
  // opens, so a saved toggle must refetch that profile.
  it('refreshes the profile it was seeded from after a save', async () => {
    render(<SharingRow initialValue={false} />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
