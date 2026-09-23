import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SharingRow } from '../sharing-row';

vi.mock('@/lib/actions/visibility/sharing-preferences', () => ({
  setAutoShareToCircle: vi.fn(async () => undefined),
}));

describe('SharingRow', () => {
  // Settings is kept alive across navigations (Cache Components), so a value
  // changed elsewhere arrives as a new prop rather than a fresh mount.
  it('adopts a new server value while it stays mounted', () => {
    const view = render(<SharingRow initialValue={false} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    view.rerender(<SharingRow initialValue={true} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
