import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', () => ({ useReducedMotion: () => false }));
vi.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: ({
    dataKey,
    type,
    strokeDasharray,
    dot,
  }: {
    dataKey: string;
    type: string;
    strokeDasharray?: string;
    dot?: unknown;
  }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-type={type}
      data-dashed={strokeDasharray ?? ''}
      data-has-dots={String(Boolean(dot))}
    />
  ),
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { WeightChart } from '../weight-chart';

describe('WeightChart series', () => {
  it('draws straight actual and forecast segments while keeping reading dots', () => {
    render(
      <WeightChart
        data={[72.4, 71.5, 70.4]}
        weightDates={['2026-08-28', '2026-09-08', '2026-09-19']}
        range="30d"
        projectedEndWeight={69.8}
        canProject
        periodElapsedDays={22}
        weightPlaceholder={70}
      />
    );

    expect(screen.getByTestId('line-actual')).toHaveAttribute(
      'data-type',
      'linear'
    );
    expect(screen.getByTestId('line-actual')).toHaveAttribute(
      'data-has-dots',
      'true'
    );
    expect(screen.getByTestId('line-forecast')).toHaveAttribute(
      'data-type',
      'linear'
    );
    expect(screen.getByTestId('line-forecast')).toHaveAttribute(
      'data-dashed',
      '4 4'
    );
  });
});
