import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HEATMAP_CELL_PAINTS } from '../heatmap-colors';
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
    // The swatch must carry the SAME paint record the grid cell consumes, not
    // an equal-looking one assembled here — assembling is what let this legend
    // omit two cell kinds and draw a third wrongly.
    expect(swatch).toHaveStyle({
      backgroundColor: HEATMAP_CELL_PAINTS.cheat.backgroundColor,
      backgroundImage: HEATMAP_CELL_PAINTS.cheat.backgroundImage,
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
