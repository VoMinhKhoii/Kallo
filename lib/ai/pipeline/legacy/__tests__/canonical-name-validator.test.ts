import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetCanonicalNameVocabularyForTests,
  type CanonicalNameValidator,
  countCanonicalNameMisses,
  createCanonicalNameValidator,
  loadCanonicalNameVocabulary,
} from '@/lib/ai/pipeline/legacy/canonical-name-validator';

describe('createCanonicalNameValidator', () => {
  let validator: CanonicalNameValidator;

  beforeEach(() => {
    validator = createCanonicalNameValidator(
      new Set(['Cá quả', 'Thịt bò', 'Bún tươi', 'Trứng gà'])
    );
  });

  it('returns hit=true when canonicalName is in the set', () => {
    expect(validator.validate('Cá quả')).toEqual({ hit: true });
  });

  it('returns hit=false with reason alias_miss when not in the set', () => {
    expect(validator.validate('Cá lóc')).toEqual({
      hit: false,
      reason: 'alias_miss',
      attemptedName: 'Cá lóc',
    });
  });

  it('is diacritic-strict', () => {
    expect(validator.validate('ca qua')).toEqual({
      hit: false,
      reason: 'alias_miss',
      attemptedName: 'ca qua',
    });
  });

  it('treats empty and null inputs as misses with a distinct reason', () => {
    expect(validator.validate('')).toEqual({
      hit: false,
      reason: 'empty',
      attemptedName: '',
    });
    expect(validator.validate(null)).toEqual({
      hit: false,
      reason: 'empty',
      attemptedName: '',
    });
  });

  it('aggregates miss counts via getMissCounts and reset', () => {
    validator.validate('Cá lóc');
    validator.validate('Cá lóc');
    validator.validate('Bún bò Huế');

    expect(validator.getMissCounts()).toEqual({
      'Cá lóc': 2,
      'Bún bò Huế': 1,
    });

    validator.reset();
    expect(validator.getMissCounts()).toEqual({});
  });
});

describe('canonicalName vocabulary loading', () => {
  beforeEach(() => {
    _resetCanonicalNameVocabularyForTests();
  });

  it('loads primary, English, and alternate names from FAO+USDA rows once', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          name_primary: 'Cá quả',
          name_en: 'Snakehead fish',
          name_alt: ['Cá lóc'],
        },
      ]),
    };

    await expect(loadCanonicalNameVocabulary(db as never)).resolves.toEqual(
      new Set(['Cá quả', 'Snakehead fish', 'Cá lóc'])
    );
    await loadCanonicalNameVocabulary(db as never);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('counts canonicalName misses for aggregate telemetry', async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValue([
          { name_primary: 'Cá quả', name_en: null, name_alt: null },
        ]),
    };

    await expect(
      countCanonicalNameMisses(['Cá quả', 'Cá lóc', 'Cá lóc'], db as never)
    ).resolves.toBe(2);
  });
});
