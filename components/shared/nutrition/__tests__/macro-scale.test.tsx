import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroScale } from '../macro-scale';

describe('MacroScale', () => {
  it('names every macro with its unit', () => {
    render(<MacroScale grams={{ protein: 38, carbohydrate: 64, fat: 12 }} />);

    expect(screen.getByText(/P:\s*38g/)).toBeInTheDocument();
    expect(screen.getByText(/C:\s*64g/)).toBeInTheDocument();
    expect(screen.getByText(/F:\s*12g/)).toBeInTheDocument();
  });

  it('says a macro was never measured rather than claiming zero', () => {
    render(<MacroScale grams={{ protein: 38, carbohydrate: 64, fat: null }} />);

    expect(screen.getByText(/F:\s*—/)).toBeInTheDocument();
    expect(screen.queryByText(/F:\s*0g/)).not.toBeInTheDocument();
  });

  it('leads the row with a caller-supplied figure and shares the width out', () => {
    const { container } = render(
      <MacroScale
        grams={{ protein: 38, carbohydrate: 64, fat: 12 }}
        leading={<span>420 kcal</span>}
      />
    );

    const row = container.firstElementChild;
    expect(row).toHaveClass('justify-between');
    expect(row).not.toHaveClass('justify-evenly');
    expect(row?.firstElementChild).toHaveTextContent('420 kcal');
  });

  it('spaces the three evenly when nothing leads them', () => {
    const { container } = render(
      <MacroScale grams={{ protein: 38, carbohydrate: 64, fat: 12 }} />
    );

    expect(container.firstElementChild).toHaveClass('justify-evenly');
  });

  it('centres each figure in its own third when asked for columns', () => {
    // The meal edit dialog: equal space either side of every figure, at a
    // position the numbers never move.
    const { container } = render(
      <MacroScale
        grams={{ protein: 152, carbohydrate: 8, fat: 36 }}
        spread="columns"
      />
    );

    const row = container.firstElementChild;
    expect(row).toHaveClass('grid', 'grid-cols-3', 'justify-items-center');
    expect(row).not.toHaveClass('justify-evenly');
    expect(row?.children).toHaveLength(3);
  });
});
