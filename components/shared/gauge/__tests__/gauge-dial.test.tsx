import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GaugeDial, gaugeLine } from '../gauge-dial';

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

  it('centres the second line on the arc tips', () => {
    renderDial(0.37);

    // radius 104 → tips at 104 + 52 = 156 from the top of the box. The hero is
    // 44 tall and the gap 2, so the stack starts at 156 − 20/2 − 2 − 44 = 100
    // and the body's own middle lands back on 156.
    const stack = screen.getByText('741').parentElement as HTMLElement;
    expect(stack.style.top).toBe('100px');
  });

  it('reserves room for a line that hangs below the arc', () => {
    const { container } = renderDial(0.37);

    // gaugeHeight(104) is 169; the readout runs to 100 + 44 + 2 + 20 + 2 + 16
    // = 184, and the box has to be the taller of the two.
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.height).toBe('184px');
  });
});
