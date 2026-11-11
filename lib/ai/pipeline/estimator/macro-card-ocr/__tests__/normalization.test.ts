import { describe, expect, it } from 'vitest';
import { NutritionLabelOcrError } from '@/lib/domain/nutrition/ocr/error';
import { normalizeCardAmount, normalizeMacroCardOcr } from '../normalization';
import type { RawMacroCardOcr } from '../raw-schema';

describe('normalizeCardAmount', () => {
  it('defaults empty unit to kcal for calories', () => {
    expect(normalizeCardAmount({ value: '333', unit: '' }, 'calories')).toBe(
      333
    );
    expect(normalizeCardAmount({ value: '333,0', unit: '' }, 'calories')).toBe(
      333
    );
  });

  it('defaults empty unit to grams for macros', () => {
    expect(normalizeCardAmount({ value: '45,9', unit: '' }, 'macro')).toBe(
      45.9
    );
    expect(normalizeCardAmount({ value: '18', unit: 'g' }, 'macro')).toBe(18);
  });

  it('converts mg to g for macros', () => {
    expect(normalizeCardAmount({ value: '500', unit: 'mg' }, 'macro')).toBe(
      0.5
    );
  });

  it('rejects percentage tokens as null', () => {
    expect(normalizeCardAmount({ value: '15', unit: '%' }, 'macro')).toBeNull();
    expect(
      normalizeCardAmount({ value: '20', unit: '% DV' }, 'calories')
    ).toBeNull();
  });
});

describe('normalizeMacroCardOcr', () => {
  const validRaw: RawMacroCardOcr = {
    cardDetected: true,
    itemName: 'SOU-MADE BOWL (V1)',
    evidence: '377 CALORIES 18g PROTEIN 55g CARBS 10g FAT',
    calories: { value: '377', unit: 'kcal' },
    proteinGrams: { value: '18', unit: 'g' },
    carbsGrams: { value: '55', unit: 'g' },
    fatGrams: { value: '10', unit: 'g' },
    confidence: 'high',
  };

  it('normalizes valid macro card into ParsedNutritionLabel per_serving', () => {
    const parsed = normalizeMacroCardOcr(validRaw);
    expect(parsed.basis).toBe('per_serving');
    if (parsed.basis !== 'per_serving') return;
    expect(parsed.productName).toBe('SOU-MADE BOWL (V1)');
    expect(parsed.labelEvidence).toBe(validRaw.evidence);
    expect(parsed.perServing.calories).toBe(377);
    expect(parsed.perServing.proteinGrams).toBe(18);
    expect(parsed.perServing.carbsGrams).toBe(55);
    expect(parsed.perServing.fatGrams).toBe(10);
    // Unprinted micronutrients MUST be null, never 0
    expect(parsed.perServing.fiberGrams).toBeNull();
    expect(parsed.perServing.sodiumMg).toBeNull();
  });

  it('handles missing units on macro values gracefully', () => {
    const rawWithMissingUnits: RawMacroCardOcr = {
      ...validRaw,
      calories: { value: '324,7', unit: '' },
      carbsGrams: { value: '45,9', unit: '' },
    };
    const parsed = normalizeMacroCardOcr(rawWithMissingUnits);
    expect(parsed.basis).toBe('per_serving');
    if (parsed.basis !== 'per_serving') return;
    expect(parsed.perServing.calories).toBe(324.7);
    expect(parsed.perServing.carbsGrams).toBe(45.9);
  });

  it('throws no_label_detected when cardDetected is false', () => {
    expect(() => normalizeMacroCardOcr({ cardDetected: false })).toThrowError(
      new NutritionLabelOcrError('no_label_detected')
    );
  });

  it('throws no_label_detected when evidence is empty', () => {
    expect(() =>
      normalizeMacroCardOcr({ ...validRaw, evidence: '' })
    ).toThrowError(new NutritionLabelOcrError('no_label_detected'));
  });

  it('downgrades confidence to low on material 4/4/9 macro disagreement', () => {
    const inconsistentRaw: RawMacroCardOcr = {
      ...validRaw,
      calories: { value: '900', unit: 'kcal' }, // 18*4 + 55*4 + 10*9 = 382 kcal vs 900
      confidence: 'high',
    };
    const parsed = normalizeMacroCardOcr(inconsistentRaw);
    expect(parsed.confidence).toBe('low');
  });

  it('normalizes fiberGrams and servingSize when present on meal prep / fitfood cards', () => {
    const mealPrepRaw: RawMacroCardOcr = {
      ...validRaw,
      itemName: 'Grilled Chicken Quinoa Bowl',
      calories: { value: '450', unit: 'CAL' },
      proteinGrams: { value: '45', unit: 'g' },
      carbsGrams: { value: '45', unit: 'g' },
      fatGrams: { value: '12', unit: 'g' },
      fiberGrams: { value: '8', unit: 'g' },
      servingSizeDescription: '1 bowl (300g)',
    };
    const parsed = normalizeMacroCardOcr(mealPrepRaw);
    expect(parsed.basis).toBe('per_serving');
    if (parsed.basis !== 'per_serving') return;
    expect(parsed.perServing.fiberGrams).toBe(8);
    expect(parsed.servingSize).toEqual({ value: 300, unit: 'g' });
    expect(parsed.servingSizeDescription).toBe('1 bowl (300g)');
  });

  it('converts kJ energy to calories for smoothie menu cards', () => {
    const smoothieRaw: RawMacroCardOcr = {
      cardDetected: true,
      itemName: 'Wondermelon',
      evidence: 'orig 808 kJ med 663 kJ (13.3 g of protein*)',
      calories: { value: '808', unit: 'kJ' },
      proteinGrams: { value: '13.3', unit: 'g' },
      carbsGrams: null,
      fatGrams: null,
      confidence: 'high',
    };
    const parsed = normalizeMacroCardOcr(smoothieRaw);
    expect(parsed.basis).toBe('per_serving');
    if (parsed.basis !== 'per_serving') return;
    expect(parsed.perServing.calories).toBeCloseTo(193.1, 1);
    expect(parsed.perServing.proteinGrams).toBe(13.3);
    expect(parsed.perServing.carbsGrams).toBeNull();
    expect(parsed.perServing.fatGrams).toBeNull();
  });

  it('derives calories from 4/4/9 when calories is omitted but all 3 macros are present', () => {
    const badgeOnlyRaw: RawMacroCardOcr = {
      cardDetected: true,
      itemName: 'Grilled Chicken Al Pastor Bowls',
      evidence: 'P 44G C 44G F 5G',
      calories: null,
      proteinGrams: { value: '44', unit: 'G' },
      carbsGrams: { value: '44', unit: 'G' },
      fatGrams: { value: '5', unit: 'G' },
      confidence: 'high',
    };
    const parsed = normalizeMacroCardOcr(badgeOnlyRaw);
    expect(parsed.basis).toBe('per_serving');
    if (parsed.basis !== 'per_serving') return;
    // 44*4 + 44*4 + 5*9 = 176 + 176 + 45 = 397 kcal
    expect(parsed.perServing.calories).toBe(397);
    expect(parsed.perServing.proteinGrams).toBe(44);
    expect(parsed.perServing.carbsGrams).toBe(44);
    expect(parsed.perServing.fatGrams).toBe(5);
  });
});
