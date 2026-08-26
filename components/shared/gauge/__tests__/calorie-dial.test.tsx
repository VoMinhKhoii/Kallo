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
/** Comfortably above `LONG_WORDING_MIN_RADIUS` — the dashboard's own size. */
const LONG = 88;
/** Below it — the logging header's size. */
const SHORT = 52;

function renderDial(logged: number, goal: Goal | null) {
  return render(
    <CalorieDial goal={goal} logged={logged} radius={LONG} target={TARGET} />
  );
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

  it('draws the arc at the radius it is handed', () => {
    const { container } = render(
      <CalorieDial goal={null} logged={741} radius={SHORT} target={TARGET} />
    );

    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe(`${SHORT * 2}`);
  });

  it('shortens both lower lines once the arc is too small for the words', () => {
    render(
      <CalorieDial goal="cutting" logged={741} radius={SHORT} target={TARGET} />
    );

    // The unit line lands ON the tips, where the opening is only ~1.48x the
    // radius. The sentence does not fit there at this size; one word does, and
    // the detail drops to the bare fraction every locale renders the same width.
    expect(screen.getByText('remainingShort')).toBeInTheDocument();
    expect(screen.queryByText('kcalRemaining')).not.toBeInTheDocument();
    expect(
      screen.getByText('loggedOverTarget logged=741 target=2,000')
    ).toBeInTheDocument();
  });

  it('carries the overshoot in the detail line, not just in the arc', () => {
    // A bulker past target: the framing leads with what was logged, so the line
    // under it is the one that names the overshoot.
    render(
      <CalorieDial goal="bulking" logged={2341} radius={LONG} target={TARGET} />
    );

    const detail = screen.getByText('overTargetBy over=341 target=2,000');
    expect(detail.className).toContain('text-kallo-danger');
  });
});
