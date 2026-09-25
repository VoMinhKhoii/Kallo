import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PremiumChip } from '@/components/billing/premium-chip';
import { PremiumDot } from '@/components/billing/premium-dot';

// The two Premium markers. Their colours are `--kallo-premium-*` tokens, so
// these pin the token classes and the geometry the spec fixes, not hexes.

describe('PremiumChip', () => {
  it('renders the Premium label as the soft blue 18px pill', () => {
    render(<PremiumChip />);
    const chip = screen.getByText('premium.chip');

    expect(chip.className).toContain('h-[18px]');
    expect(chip.className).toContain('px-[7px]');
    expect(chip.className).toContain('rounded-full');
    expect(chip.className).toContain('text-[11px]');
    expect(chip.className).toContain('font-semibold');
    expect(chip.className).toContain('bg-kallo-premium-fill');
    expect(chip.className).toContain('border-kallo-premium-edge');
    expect(chip.className).toContain('text-kallo-premium-ink');
    // The old yellow marker ink must be gone.
    expect(chip.className).not.toContain('kallo-highlight');
  });

  it('lets the row place it without overriding its shape', () => {
    render(<PremiumChip className="ml-auto" />);

    expect(screen.getByText('premium.chip').className).toContain('ml-auto');
  });
});

describe('PremiumDot', () => {
  it('is a decorative 7px blue dot with a white ring on the corner', () => {
    const { container } = render(
      <span className="relative">
        <PremiumDot />
      </span>
    );
    const dot = container.querySelector('[data-premium-dot]') as HTMLElement;

    expect(dot).not.toBeNull();
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.textContent).toBe('');
    expect(dot.className).toContain('size-[7px]');
    expect(dot.className).toContain('bg-kallo-premium-dot');
    expect(dot.className).toContain('ring-2');
    expect(dot.className).toContain('ring-white');
    expect(dot.className).toContain('absolute');
  });
});
