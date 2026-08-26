import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { gaugeHeight } from '@/lib/core/ui/gauge-arc-geometry';
import { gaugeFigureSize } from '@/lib/core/ui/gauge-figure-size';
import { gaugeReadoutLayout } from '@/lib/core/ui/gauge-readout-layout';
import { GaugeDial } from '../gauge-dial';
import { gaugeCalorieLines, gaugeReadoutHeights } from '../gauge-lines';

const RADIUS = 104;

const LINES = gaugeCalorieLines(
  { figure: '741', unit: 'kcal logged', detail: '1,259/2,000 left' },
  RADIUS
);

function renderDial(progress: number) {
  return render(
    <GaugeDial
      fill="var(--kallo-accent)"
      progress={progress}
      radius={RADIUS}
      {...LINES}
    />
  );
}

const LINE_HEIGHTS = gaugeReadoutHeights(RADIUS, 'calorie');

describe('GaugeDial', () => {
  it('draws both segments and the readout', () => {
    const { container } = renderDial(0.37);

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(screen.getByText('741')).toBeInTheDocument();
    expect(screen.getByText('kcal logged')).toBeInTheDocument();
    expect(screen.getByText('1,259/2,000 left')).toBeInTheDocument();
  });

  it('places the readout where the layout rule says', () => {
    const { container } = renderDial(0.37);
    // The rule itself is `gaugeReadoutLayout`'s, and tested there. What this
    // asserts is that the component actually applies its answer.
    const layout = gaugeReadoutLayout(RADIUS, LINE_HEIGHTS);

    const stack = screen.getByText('741').parentElement as HTMLElement;
    expect(stack.style.paddingTop).toBe(`${layout.readoutTop}px`);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.minHeight).toBe(`${layout.height}px`);
    expect(layout.height).toBeGreaterThan(gaugeHeight(RADIUS));
  });

  it('sizes the figure from the radius, not from a fixed role', () => {
    renderDial(0.37);

    const figure = screen.getByText('741');
    expect(figure.style.fontSize).toBe(
      `${gaugeFigureSize(RADIUS, 'calorie')}px`
    );
    // Half the radius must draw a visibly smaller figure — that is the whole
    // point of deriving it.
    expect(gaugeFigureSize(52, 'calorie')).toBeLessThan(
      gaugeFigureSize(RADIUS, 'calorie')
    );
  });

  it('caps a day that ran past target, so 101% cannot read as 100%', () => {
    const cap = (root: HTMLElement) =>
      root.querySelector('path[fill="var(--kallo-danger)"]');

    // The fill clamps at 1, so without the cap these two paint identically.
    const onTarget = renderDial(1);
    expect(cap(onTarget.container)).toBeNull();
    onTarget.unmount();

    const over = renderDial(1.2);
    expect(cap(over.container)).not.toBeNull();
  });
});
