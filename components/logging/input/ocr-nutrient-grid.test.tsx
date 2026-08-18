import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type MacroItem,
  OcrMacroGrid,
  OcrNutrientGrid,
} from './ocr-nutrient-grid';

function item(overrides: Partial<MacroItem> & { key: string }): MacroItem {
  return {
    id: `ocr-nutrient-${overrides.key}`,
    label: overrides.key,
    val: '1',
    unit: 'g',
    hasError: false,
    errorText: 'Enter a valid value.',
    setter: vi.fn(),
    ...overrides,
  };
}

const MACROS: MacroItem[] = [
  item({ key: 'calories', label: 'Calories', unit: 'kcal', required: true }),
  item({ key: 'proteinGrams', label: 'Protein', required: true }),
  item({ key: 'carbsGrams', label: 'Carbohydrates', required: true }),
  item({ key: 'fatGrams', label: 'Fat', required: true }),
];

describe('OcrMacroGrid', () => {
  it('gives calories its own row and the other three a shared one', () => {
    const { container } = render(<OcrMacroGrid items={MACROS} />);

    // The trio lives in a 3-column grid; calories sits outside it.
    const trio = container.querySelector('.grid-cols-3');
    expect(trio).not.toBeNull();
    expect(trio?.children).toHaveLength(3);
    expect(trio?.textContent).not.toContain('Calories');
  });

  it('marks every required field with an asterisk', () => {
    render(<OcrMacroGrid items={MACROS} />);

    expect(screen.getAllByText('*')).toHaveLength(4);
    for (const label of ['Calories', 'Protein', 'Carbohydrates', 'Fat']) {
      expect(screen.getByLabelText(new RegExp(label))).toHaveAttribute(
        'aria-required',
        'true'
      );
    }
  });

  it('shows the error only on the field that has one', () => {
    render(
      <OcrMacroGrid
        items={MACROS.map((macro) =>
          macro.key === 'proteinGrams' ? { ...macro, hasError: true } : macro
        )}
      />
    );

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText(/Protein/)).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText(/Fat/)).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  });
});

describe('OcrNutrientGrid', () => {
  it('renders micronutrients unmarked, two to a row above 380px', () => {
    const { container } = render(
      <OcrNutrientGrid
        items={[
          item({ key: 'sodiumMg', label: 'Sodium', unit: 'mg' }),
          item({ key: 'ironMg', label: 'Iron', unit: 'mg' }),
        ]}
      />
    );

    expect(screen.queryByText('*')).toBeNull();
    expect(
      container.querySelector('.min-\\[380px\\]\\:grid-cols-2')
    ).not.toBeNull();
  });
});
