import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroScale } from '../macro-scale';

describe('MacroScale', () => {
  it('names every macro with its unit', () => {
    render(<MacroScale carbohydrate={64} fat={12} protein={38} />);

    expect(screen.getByText(/P:\s*38g/)).toBeInTheDocument();
    expect(screen.getByText(/C:\s*64g/)).toBeInTheDocument();
    expect(screen.getByText(/F:\s*12g/)).toBeInTheDocument();
  });

  it('says a macro was never measured rather than claiming zero', () => {
    render(<MacroScale carbohydrate={64} fat={null} protein={38} />);

    expect(screen.getByText(/F:\s*—/)).toBeInTheDocument();
    expect(screen.queryByText(/F:\s*0g/)).not.toBeInTheDocument();
  });
});
