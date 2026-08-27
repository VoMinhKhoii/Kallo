import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { NutritionData } from '@/lib/core/types/dashboard';
import {
  DOCK_MACRO_CAP,
  gaugeStripSizes,
} from '@/lib/core/ui/gauge-strip-layout';
import { TodayDock } from '../today-dock';

const NUTRITION: NutritionData = {
  calories: { current: 1055, target: 1844 },
  protein: { current: 79, target: 138 },
  carbs: { current: 111, target: 161 },
  fat: { current: 32, target: 72 },
};

/**
 * The strip sizes its marks from the box it lands in, and jsdom has no layout —
 * so pin a width. 588 is what a 16-inch MacBook actually gives the dock's gauge
 * column (a 1368px card, 44% of its content box).
 */
const COLUMN = 588;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: COLUMN,
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: COLUMN, height: 0 }),
  });
});

const widths = () =>
  Array.from(document.querySelectorAll('svg.absolute'), (gauge) =>
    gauge.getAttribute('width')
  );

describe('TodayDock', () => {
  it('draws one row of four marks, sized from the column it was given', () => {
    render(<TodayDock goal="cutting" meals={[]} nutrition={NUTRITION} />);

    const gauges = screen.getByTestId('gauge-layout');
    const { calorieRadius, macroRadius } = gaugeStripSizes(
      COLUMN,
      DOCK_MACRO_CAP
    );

    // ONE composition — the card used to swap a stacked full-size cluster for a
    // compact side-by-side one at 1280px, so only the container may change now.
    expect(screen.queryByTestId('gauge-strip-stacked')).not.toBeInTheDocument();
    expect(widths()).toEqual([
      `${calorieRadius * 2}`,
      `${macroRadius * 2}`,
      `${macroRadius * 2}`,
      `${macroRadius * 2}`,
    ]);
    // The calorie mark stays clearly dominant at whatever size it lands on.
    expect(calorieRadius).toBeGreaterThan(macroRadius * 1.5);

    expect(within(gauges).getByText('789')).toBeInTheDocument();
    expect(within(gauges).getByText('79g')).toBeInTheDocument();
    expect(within(gauges).getByText('111g')).toBeInTheDocument();
    expect(within(gauges).getByText('32g')).toBeInTheDocument();
  });

  it('keeps the row intact for zero targets and four-digit values', () => {
    render(
      <TodayDock
        goal="maintaining"
        meals={[]}
        nutrition={{
          calories: { current: 4321, target: 0 },
          protein: { current: 1234, target: 0 },
          carbs: { current: 2345, target: 0 },
          fat: { current: 3456, target: 0 },
        }}
      />
    );

    const gauges = screen.getByTestId('gauge-layout');
    expect(widths()).toHaveLength(4);
    expect(within(gauges).getByText('1234g')).toBeInTheDocument();
    expect(within(gauges).getByText('2345g')).toBeInTheDocument();
    expect(within(gauges).getByText('3456g')).toBeInTheDocument();
  });

  it('gives the meals the larger share of the card', () => {
    const { container } = render(
      <TodayDock goal="cutting" meals={[]} nutrition={NUTRITION} />
    );

    // The gauge column is deliberately bounded so the meal rows get the width
    // their macro figures were being crowded out of.
    expect(container.firstElementChild).toHaveClass(
      'xl:grid-cols-[44%_minmax(0,1fr)]'
    );
  });
});
