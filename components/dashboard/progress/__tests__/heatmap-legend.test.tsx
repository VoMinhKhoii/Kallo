import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HEATMAP_CHEAT } from '../heatmap-colors';
import { HeatmapLegend } from '../heatmap-legend';

describe('HeatmapLegend', () => {
  it('names every kind of cell the grid can paint', () => {
    render(<HeatmapLegend numWeeks={14} />);

    // The regression: cheatDay and partial were absent, so two cell kinds the
    // grid draws had no key — a legend that omits one quietly reclassifies it.
    for (const key of [
      'notLogged',
      'onTarget',
      'overTarget',
      'cheatDay',
      'partial',
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('draws the cheat swatch exactly as the cell paints it', () => {
    render(<HeatmapLegend numWeeks={14} />);

    const swatch = screen.getByText('cheatDay').previousElementSibling;
    // Two layers, as the cell uses: the wash is translucent, so it rides on
    // the base as backgroundImage rather than replacing it.
    // toHaveStyle, not a string compare on style.backgroundImage: jsdom
    // re-serialises `rgb(r g b / a)` to legacy `rgba(r, g, b, a)`, so the raw
    // property never equals the source literal even when it is the same paint.
    expect(swatch).toHaveStyle({
      backgroundColor: HEATMAP_CHEAT.fill,
      backgroundImage: HEATMAP_CHEAT.gradient,
    });
    // Ringless, because the cell is ringless — being the grid's only gradient
    // is what earns that.
    expect(swatch).not.toHaveClass('border');
  });

  it('keeps the ring on the one cell that has one', () => {
    render(<HeatmapLegend numWeeks={14} />);

    const swatch = screen.getByText('partial').previousElementSibling;
    expect(swatch).toHaveClass('border', 'border-kallo-text-muted');
  });
});
