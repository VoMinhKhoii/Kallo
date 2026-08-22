import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Goal } from '@/lib/domain/onboarding/types';
import { CalorieDial } from '../calorie-dial';

// The global next-intl mock drops interpolated params, and the claim this file
// makes about the detail line IS its numbers ("the overshoot is not hidden").
// So format them in: `leftOfTarget left=150 target=2,000`.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params
      ? `${key} ${Object.entries(params)
          .map(([name, value]) => `${name}=${value}`)
          .join(' ')}`
      : key,
  useLocale: () => 'en',
}));

const TARGET = 2000;

function renderDial(logged: number, goal: Goal | null) {
  return render(<CalorieDial goal={goal} logged={logged} target={TARGET} />);
}

describe('CalorieDial', () => {
  it('counts down for a cutter — what is left is the number they act on', () => {
    renderDial(741, 'cutting');

    expect(screen.getByText('1,259')).toBeInTheDocument();
    expect(screen.getByText('kcalRemaining')).toBeInTheDocument();
    expect(
      screen.getByText('loggedOfTarget logged=741 target=2,000')
    ).toBeInTheDocument();
  });

  it.each<Goal | null>([
    'bulking',
    'maintaining',
    null,
  ])('counts up for %s — the figure they are trying to reach', (goal) => {
    renderDial(741, goal);

    expect(screen.getByText('741')).toBeInTheDocument();
    expect(screen.getByText('caloriesLogged')).toBeInTheDocument();
    expect(
      screen.getByText('leftOfTarget left=1,259 target=2,000')
    ).toBeInTheDocument();
  });

  it('names the overshoot rather than a negative remainder', () => {
    renderDial(2341, 'bulking');

    expect(screen.getByText('2,341')).toBeInTheDocument();
    expect(
      screen.getByText('overTargetBy over=341 target=2,000')
    ).toBeInTheDocument();
  });

  it('shows a cutter past target 0, never a negative', () => {
    renderDial(2341, 'cutting');

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('-341')).not.toBeInTheDocument();
    expect(screen.queryByText('−341')).not.toBeInTheDocument();
    // The deficit is spent, but the overshoot is still on screen.
    expect(
      screen.getByText('loggedOfTarget logged=2,341 target=2,000')
    ).toBeInTheDocument();
  });

  it('does not shift the layout when the goal flips', () => {
    const cutting = renderDial(741, 'cutting');
    const cuttingBox = (cutting.container.firstElementChild as HTMLElement)
      .style.minHeight;
    cutting.unmount();

    const bulking = renderDial(741, 'bulking');
    expect(cuttingBox).not.toBe('');
    expect(
      (bulking.container.firstElementChild as HTMLElement).style.minHeight
    ).toBe(cuttingBox);
  });

  it('draws the compact variant at half the radius', () => {
    const { container } = render(
      <CalorieDial goal={null} logged={741} target={TARGET} variant="compact" />
    );

    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('104');
  });

  it('shortens both lower lines on the compact variant', () => {
    render(
      <CalorieDial
        goal="cutting"
        logged={741}
        target={TARGET}
        variant="compact"
      />
    );

    // The dock's sentence does not fit a 104px mouth; one word does, and the
    // detail drops to the bare fraction every locale renders the same width.
    expect(screen.getByText('remainingShort')).toBeInTheDocument();
    expect(screen.queryByText('kcalRemaining')).not.toBeInTheDocument();
    expect(
      screen.getByText('loggedOverTarget logged=741 target=2,000')
    ).toBeInTheDocument();
  });
});
