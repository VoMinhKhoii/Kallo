import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';

export interface CanonicalNameValidationHit {
  hit: true;
}

export interface CanonicalNameValidationMiss {
  hit: false;
  reason: 'alias_miss' | 'empty';
  attemptedName: string;
}

export type CanonicalNameValidationResult =
  | CanonicalNameValidationHit
  | CanonicalNameValidationMiss;

export interface CanonicalNameValidator {
  validate: (name: string | null | undefined) => CanonicalNameValidationResult;
  getMissCounts: () => Record<string, number>;
  reset: () => void;
}

/**
 * The three columns the vocabulary SELECT below names, from
 * `vietnamese_food_composition` (lib/db/schema.ts). `name_alt` is a nullable
 * `text[]`; `name_primary` and `name_en` are declared `notNull()` there, but
 * this type keeps them nullable on purpose — the reader is deliberately
 * tolerant of missing names (telemetry must never take the pipeline down) and
 * `__tests__/canonical-name-validator.test.ts` exercises a `name_en: null` row.
 * Widening past the schema is safe; narrowing past it would not be.
 */
type VocabularyRow = {
  name_primary?: string | null;
  name_en?: string | null;
  name_alt?: string[] | null;
};

let vocabularyPromise: Promise<ReadonlySet<string>> | null = null;

export function createCanonicalNameValidator(
  fctVocabulary: ReadonlySet<string>
): CanonicalNameValidator {
  const missCounts = new Map<string, number>();

  return {
    validate(name) {
      const attemptedName = name ?? '';
      if (!attemptedName) {
        return { hit: false, reason: 'empty', attemptedName: '' };
      }
      if (fctVocabulary.has(attemptedName)) return { hit: true };
      missCounts.set(attemptedName, (missCounts.get(attemptedName) ?? 0) + 1);
      return { hit: false, reason: 'alias_miss', attemptedName };
    },
    getMissCounts() {
      return Object.fromEntries(missCounts);
    },
    reset() {
      missCounts.clear();
    },
  };
}

export async function loadCanonicalNameVocabulary(
  db: AppDb
): Promise<ReadonlySet<string>> {
  if (!vocabularyPromise) {
    vocabularyPromise = db
      .execute<VocabularyRow>(
        sql`SELECT DISTINCT name_primary, name_en, name_alt
            FROM vietnamese_food_composition
            WHERE source_id IN (1, 2)`
      )
      .then((rows) => {
        const vocabulary = new Set<string>();
        for (const row of rows) {
          if (row.name_primary) vocabulary.add(row.name_primary);
          if (row.name_en) vocabulary.add(row.name_en);
          for (const alt of row.name_alt ?? []) {
            if (alt) vocabulary.add(alt);
          }
        }
        return vocabulary;
      })
      .catch((err) => {
        vocabularyPromise = null;
        console.warn(
          '[pipeline] canonicalName vocabulary load failed; skipping alias miss telemetry:',
          err
        );
        return new Set<string>();
      });
  }

  return vocabularyPromise;
}

export async function countCanonicalNameMisses(
  names: readonly string[],
  db: AppDb
): Promise<number> {
  if (typeof db.execute !== 'function') return 0;

  const vocabulary = await loadCanonicalNameVocabulary(db);
  if (vocabulary.size === 0) return 0;

  const validator = createCanonicalNameValidator(vocabulary);
  for (const name of names) {
    validator.validate(name);
  }

  return Object.values(validator.getMissCounts()).reduce(
    (sum, count) => sum + count,
    0
  );
}

/** @internal Exported for tests. */
export function _resetCanonicalNameVocabularyForTests(): void {
  vocabularyPromise = null;
}
