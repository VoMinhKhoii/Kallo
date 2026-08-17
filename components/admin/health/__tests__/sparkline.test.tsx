/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Sparkline } from '../sparkline';

// recharts' ResponsiveContainer observes its box; jsdom ships neither
// ResizeObserver nor layout, so stub the observer and pin a non-zero size.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  for (const [prop, value] of [
    ['offsetWidth', 320],
    ['offsetHeight', 64],
    ['clientWidth', 320],
    ['clientHeight', 64],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value,
    });
  }
});

describe('Sparkline', () => {
  it('renders a "No data" placeholder for an empty series', () => {
    render(<Sparkline data={[]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('exposes an atomic accessible summary of the series', () => {
    render(
      <Sparkline
        data={[
          { date: '2026-08-15', count: 4 },
          { date: '2026-08-16', count: 11 },
          { date: '2026-08-17', count: 7 },
        ]}
      />
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Requests per day for the last 30 days: 22 total, minimum 4, maximum 11, latest 7 on 2026-08-17.'
    );
  });

  it('hides the chart itself from assistive tech to avoid double announcement', () => {
    const { container } = render(
      <Sparkline data={[{ date: '2026-08-17', count: 1 }]} />
    );
    expect(
      container.querySelector('[role="img"] > [aria-hidden="true"]')
    ).not.toBeNull();
  });

  // NOTE: the per-instance `linearGradient` id (the reason this component
  // calls useId) is NOT covered. recharts' ResponsiveContainer renders its
  // chart only after a real ResizeObserver callback delivers a measured box,
  // which jsdom never produces — so no <svg>, and no gradient, ever mounts.
  it('renders the chart wrapper once there is data', () => {
    const { container } = render(
      <Sparkline data={[{ date: '2026-08-17', count: 1 }]} />
    );
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
    expect(
      container.querySelector('.recharts-responsive-container')
    ).not.toBeNull();
  });
});
