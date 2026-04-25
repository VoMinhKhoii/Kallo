import { describe, expect, it } from 'vitest';
import { getCuratedFoodSourceCandidates } from './food-source-candidates';
import { SUPPORTED_CANDIDATE_NUTRIENTS } from './nutrients';

const I18N_KEY_PREFIX = 'nutrition.candidates.';

describe('curated food source candidates', () => {
  it('provides at least five candidates for every supported nutrient', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      expect(getCuratedFoodSourceCandidates(nutrient)).toHaveLength(5);
    }
  });

  it('uses nutrition candidate i18n keys for all user-facing copy', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      const candidates = getCuratedFoodSourceCandidates(nutrient);

      for (const candidate of candidates) {
        expect(candidate.nameKey).toMatch(/^nutrition\.candidates\./);
        expect(candidate.servingKey).toMatch(/^nutrition\.candidates\./);
        expect(candidate.rationaleKey).toMatch(/^nutrition\.candidates\./);

        if (candidate.cautionKey) {
          expect(candidate.cautionKey).toMatch(/^nutrition\.candidates\./);
        }
      }
    }
  });

  it('keeps nutrient ownership and ids stable for each candidate list', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      const candidates = getCuratedFoodSourceCandidates(nutrient);
      const ids = new Set<string>();

      for (const candidate of candidates) {
        expect(candidate.nutrient).toBe(nutrient);
        expect(candidate.id).toBeTruthy();
        expect(candidate.id.trim()).toBe(candidate.id);
        expect(ids.has(candidate.id)).toBe(false);
        ids.add(candidate.id);

        expect(candidate.nameKey).toBe(
          `${I18N_KEY_PREFIX}${nutrient}.${candidate.id}.name`
        );
        expect(candidate.servingKey).toBe(
          `${I18N_KEY_PREFIX}${nutrient}.${candidate.id}.serving`
        );
        expect(candidate.rationaleKey).toBe(
          `${I18N_KEY_PREFIX}${nutrient}.${candidate.id}.rationale`
        );

        if (candidate.cautionKey) {
          expect(candidate.cautionKey).toBe(
            `${I18N_KEY_PREFIX}${nutrient}.${candidate.id}.caution`
          );
        }
      }
    }
  });
});
