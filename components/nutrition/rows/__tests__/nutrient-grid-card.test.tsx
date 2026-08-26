import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NutrientCardData } from '@/lib/domain/nutrition/types';
import { NutrientGridCard } from '../nutrient-grid-card';

const MISSING_SODIUM: NutrientCardData = {
  nutrient: 'sodiumMg',
  labelKey: 'nutrition.nutrients.sodium',
  group: 'mineral',
  averagePerDay: null,
  target: 2000,
  targetSource: 'nasem',
  targetSourceLabelKey: 'nutrition.targetSources.nasem',
  unit: 'mg',
  percentOfTarget: null,
  confidence: 100,
  displayState: 'normal',
  nutrientType: 'ceiling',
};

describe('NutrientGridCard', () => {
  it('does not render a missing nutrient value as zero', () => {
    render(<NutrientGridCard card={MISSING_SODIUM} />);

    expect(screen.getByText('— / 2,000 mg')).toBeInTheDocument();
    expect(screen.queryByText('0 / 2,000 mg')).not.toBeInTheDocument();
  });
});
