import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenuButton } from './mobile-menu-button';

describe('MobileMenuButton', () => {
  // Regression: the button is mounted via Radix `SheetTrigger asChild`, which
  // hands its onClick/ref down as props. A version that didn't spread them
  // onto the <button> rendered fine but silently never opened the drawer.
  it('forwards injected trigger props (onClick) to the real button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <MobileMenuButton
        open={false}
        label="Open menu"
        onboardingIncomplete={false}
        inviteCount={0}
        onClick={onClick}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
