import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardDisclosureButton } from '../card-disclosure-button';

describe('CardDisclosureButton', () => {
  const baseProps = {
    label: 'Toggle details',
    isExpanded: false,
    onToggle: vi.fn(),
  };

  it('meets the 40px minimum touch target', () => {
    // The chevron is 16px. Wrapped in the old `p-1` it was a ~24px target —
    // under the 40x40 the design system asks for, on the control people reach
    // for most on a phone.
    render(<CardDisclosureButton {...baseProps} />);

    const button = screen.getByRole('button', { name: 'Toggle details' });
    expect(button.className).toContain('size-10');
  });

  it('does not push the header around to get that size', () => {
    // The negative margin is what lets the hit area grow without the row
    // growing with it — the same trick partial-yesterday-prompt uses.
    render(<CardDisclosureButton {...baseProps} />);

    expect(
      screen.getByRole('button', { name: 'Toggle details' }).className
    ).toContain('-m-2');
  });

  it('is reachable by keyboard with a visible focus ring', () => {
    render(<CardDisclosureButton {...baseProps} />);

    const button = screen.getByRole('button', { name: 'Toggle details' });
    expect(button.className).toContain('focus-visible:ring-2');
  });

  it('reports its expanded state and toggles on click', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<CardDisclosureButton {...baseProps} onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: 'Toggle details' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('flips the chevron once expanded', () => {
    const { container } = render(
      <CardDisclosureButton {...baseProps} isExpanded />
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'rotate-180'
    );
  });
});
