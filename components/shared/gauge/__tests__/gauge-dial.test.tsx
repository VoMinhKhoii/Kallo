import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { gaugeHeight } from '@/lib/core/ui/gauge-arc-geometry';
import { gaugeReadoutLayout } from '@/lib/core/ui/gauge-readout-layout';
import { GaugeDial } from '../gauge-dial';
import { gaugeLine } from '../gauge-lines';

function renderDial(progress: number) {
  return render(
    <GaugeDial
      fill="var(--kallo-accent)"
      primary={gaugeLine('hero', '741')}
      progress={progress}
      radius={104}
      secondary={gaugeLine('body', 'kcal logged')}
      tertiary={gaugeLine('meta', '1,259/2,000 left')}
    />
  );
}

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
    const layout = gaugeReadoutLayout(104, [44, 20, 16]);

    const stack = screen.getByText('741').parentElement as HTMLElement;
    expect(stack.style.paddingTop).toBe(`${layout.readoutTop}px`);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.minHeight).toBe(`${layout.height}px`);
    expect(layout.height).toBeGreaterThan(gaugeHeight(104));
  });
});
