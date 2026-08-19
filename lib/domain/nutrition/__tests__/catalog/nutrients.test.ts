import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_NUTRIENTS,
  DEFAULT_NUTRIENTS,
  getNutrientMeta,
  HIDDEN_NUTRIENTS,
  MORE_NUTRIENTS,
} from '@/lib/domain/nutrition/catalog/nutrients';

describe('nutrition nutrient metadata', () => {
  it('keeps biotin hidden', () => {
    expect(HIDDEN_NUTRIENTS).toContain('vitaminHMcg');
    expect(DEFAULT_NUTRIENTS).not.toContain('vitaminHMcg');
  });

  it('includes the approved default scored nutrients', () => {
    expect(DEFAULT_NUTRIENTS).toEqual([
      'calciumMg',
      'ironMg',
      'vitaminCMg',
      'phosphorusMg',
      'vitaminB1Mg',
      'vitaminB2Mg',
      'vitaminPpMg',
      'vitaminAMcg',
    ]);
  });

  it('offers candidates for every default and extended nutrient', () => {
    expect(CANDIDATE_NUTRIENTS).toEqual([
      ...DEFAULT_NUTRIENTS,
      ...MORE_NUTRIENTS,
    ]);
  });

  it('defines units and message keys for default nutrients', () => {
    for (const nutrient of DEFAULT_NUTRIENTS) {
      const meta = getNutrientMeta(nutrient);
      expect(meta.labelKey).toMatch(/^nutrition\.nutrients\./);
      expect(meta.unit).toBeTruthy();
      expect(['mineral', 'vitamin', 'other']).toContain(meta.group);
    }
  });
});
