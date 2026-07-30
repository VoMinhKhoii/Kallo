/**
 * SQL-level tests for the relog `/`-picker candidate queries.
 *
 * Runs the PRODUCTION query functions (`loadRelogDishCandidates`,
 * `loadRelogMealCandidates`) against a live Postgres, so the diacritic routing,
 * dedup, ranking and eligibility rules are verified as executed rather than as
 * intended. Each case seeds inside a transaction and rolls it back, so the
 * target database is left untouched.
 *
 * Requires: DATABASE_URL in .env.local pointing at a database that has the
 * `meals` / `meal_items` tables, `extensions.unaccent`, and at least one row in
 * `auth.users` (borrowed as the seed owner — the FK requires a real user).
 *
 * Run: bun --env-file=.env.local vitest run lib/db/__tests__/relog-candidates.test.ts
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  afterAll,
  beforeAll,
  describe as describeBase,
  expect,
  it,
} from 'vitest';
import { encodeDbUrl } from '@/lib/db';
import { loadRelogDishCandidates } from '@/lib/logging/relog/dish-query';
import { loadRelogMealCandidates } from '@/lib/logging/relog/meal-query';

// ─── Setup ───────────────────────────────────────────────────────────────────

async function resolveSeedUserId(databaseUrl: string): Promise<string | null> {
  const client = postgres(encodeDbUrl(databaseUrl), { prepare: false, max: 1 });
  try {
    const rows = await client<{ id: string }[]>`
      SELECT id FROM auth.users LIMIT 1
    `;
    if (rows.length === 0) return null;
    // Confirm the relog tables + unaccent are present before claiming support.
    await client`SELECT extensions.unaccent('a')`;
    await client`SELECT 1 FROM meal_items LIMIT 1`;
    return rows[0].id;
  } catch {
    return null;
  } finally {
    await client.end();
  }
}

const databaseUrl = process.env.DATABASE_URL;
const seedUserId = databaseUrl ? await resolveSeedUserId(databaseUrl) : null;
const describe = seedUserId ? describeBase : describeBase.skip;

let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

if (seedUserId && databaseUrl) {
  beforeAll(() => {
    client = postgres(encodeDbUrl(databaseUrl), { prepare: false, max: 1 });
    db = drizzle(client);
  });
  afterAll(async () => {
    await client.end();
  });
}

// ─── Seed ────────────────────────────────────────────────────────────────────

const USER = () => seedUserId as string;
/** A user id that owns nothing — proves the tenant predicate, without needing
 *  a second real account in the target database. */
const STRANGER = '00000000-0000-0000-0000-0000000000ff';

/**
 * Every seeded name carries this suffix so the file is hermetic: the seed user
 * is BORROWED from the target database and may already own meals — and
 * relog-write.test.ts commits rows for the same user while this file runs. An
 * untagged "Phở bò" would then pick up foreign occurrences and skew both the
 * occurrence count and which instance is "most recent". Substring matching
 * means the suffix does not interfere with any query under test.
 */
const TAG = 'rlqfixture';
const tag = (name: string) => `${name} ${TAG}`;
const untag = (name: string) => name.replace(new RegExp(` ${TAG}$`), '');

interface SeedDish {
  name: string;
  ingredients: string[];
  kcal: number;
  grams: number | null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedMeal(
  tx: Tx,
  opts: {
    rawInput: string;
    daysAgo: number;
    dishes: SeedDish[];
    entryMode?: string;
    portionFactor?: number;
    confidence?: string | null;
  }
): Promise<string> {
  const rows = await tx.execute(sql`
    INSERT INTO meals (user_id, raw_input, logged_at, entry_mode,
                       portion_factor, confidence_overall, calories_kcal)
    VALUES (
      ${USER()}, ${tag(opts.rawInput)},
      now() - (${opts.daysAgo} || ' days')::interval,
      ${opts.entryMode ?? 'precise'}, ${opts.portionFactor ?? 1},
      ${opts.confidence ?? 'high'}, 999
    )
    RETURNING id
  `);
  const mealId = String((rows as unknown as { id: string }[])[0].id);

  for (const [order, dish] of opts.dishes.entries()) {
    for (const ingredient of dish.ingredients) {
      await tx.execute(sql`
        INSERT INTO meal_items (
          meal_id, ingredient_name, meal_item_name, meal_item_order,
          estimated_grams, calories_kcal, protein_g
        ) VALUES (
          ${mealId}, ${ingredient}, ${tag(dish.name)}, ${order},
          ${dish.grams == null ? null : dish.grams / dish.ingredients.length},
          ${dish.kcal / dish.ingredients.length},
          ${1}
        )
      `);
    }
  }
  return mealId;
}

/** Seed the fixture history, run `body`, then roll everything back. */
async function withHistory(body: (tx: Tx) => Promise<void>): Promise<void> {
  const ROLLBACK = 'relog-test-rollback';
  try {
    await db.transaction(async (tx) => {
      // "Phở bò" twice — the newer one must become the payload.
      await seedMeal(tx, {
        rawInput: 'phở bò với trà đá',
        daysAgo: 1,
        dishes: [
          {
            name: 'Phở bò',
            ingredients: ['bánh phở', 'thịt bò'],
            kcal: 400,
            grams: 500,
          },
          { name: 'Trà đá', ingredients: ['trà'], kcal: 10, grams: 200 },
        ],
      });
      await seedMeal(tx, {
        rawInput: 'phở bò',
        daysAgo: 5,
        dishes: [
          {
            name: 'Phở bò',
            ingredients: ['bánh phở', 'thịt bò'],
            kcal: 999,
            grams: 900,
          },
        ],
        confidence: 'low',
      });
      // Same meal, different punctuation — the accepted weak meal dedup.
      await seedMeal(tx, {
        rawInput: 'phở bò + trà đá',
        daysAgo: 3,
        dishes: [
          { name: 'Phở bò', ingredients: ['bánh phở'], kcal: 380, grams: 480 },
        ],
      });
      // "bơ" vs "bò" — the load-bearing diacritic pair.
      await seedMeal(tx, {
        rawInput: 'bánh mì bơ',
        daysAgo: 2,
        dishes: [
          { name: 'Bơ đậu phộng', ingredients: ['bơ'], kcal: 100, grams: 30 },
        ],
      });
      // Prefix vs mid-string on "tra".
      await seedMeal(tx, {
        rawInput: 'sữa trà xanh',
        daysAgo: 2,
        dishes: [
          {
            name: 'Sữa trà xanh',
            ingredients: ['trà xanh'],
            kcal: 150,
            grams: 300,
          },
        ],
      });
      // A staple: 5 occurrences, so it outranks a fresher one-off.
      for (const daysAgo of [1, 2, 3, 4, 6]) {
        await seedMeal(tx, {
          rawInput: `cà phê sữa đá ${daysAgo}`,
          daysAgo,
          dishes: [
            {
              name: 'Cà phê sữa đá',
              ingredients: ['cà phê'],
              kcal: 140,
              grams: 120,
            },
          ],
        });
      }
      // A one-off logged today.
      await seedMeal(tx, {
        rawInput: 'bún chả',
        daysAgo: 0,
        dishes: [
          { name: 'Bún chả', ingredients: ['bún'], kcal: 600, grams: 400 },
        ],
      });
      // Excluded: a cheat meal (no item rows at all).
      await seedMeal(tx, {
        rawInput: 'tiệc nướng',
        daysAgo: 1,
        dishes: [],
        entryMode: 'cheat',
      });
      // Excluded: a split share — its rows are ALREADY halved.
      await seedMeal(tx, {
        rawInput: 'phở gà chia đôi',
        daysAgo: 1,
        portionFactor: 0.5,
        dishes: [
          { name: 'Phở gà', ingredients: ['bánh phở'], kcal: 200, grams: 250 },
        ],
      });
      // Excluded: out of the lookback window.
      await seedMeal(tx, {
        rawInput: 'món cũ',
        daysAgo: 400,
        dishes: [{ name: 'Món cũ', ingredients: ['x'], kcal: 100, grams: 100 }],
      });

      await body(tx);
      throw new Error(ROLLBACK);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }
}

const dishes = (tx: Tx, query: string, limit = 100) =>
  loadRelogDishCandidates(tx, { userId: USER(), query, limit });
const mealsFor = (tx: Tx, query: string, limit = 100) =>
  loadRelogMealCandidates(tx, { userId: USER(), query, limit });
/** Names with the fixture suffix stripped, and anything the fixture did not
 *  seed dropped — so assertions read naturally and stay hermetic. */
const names = (rows: { name: string }[]) =>
  rows.filter((r) => r.name.endsWith(TAG)).map((r) => untag(r.name));
/** Exact match against the TAGGED name — comparing the untagged form would let
 *  an identically-named foreign row (relog-write.test.ts seeds "Phở bò" too)
 *  slip through, since untag() is a no-op on names that lack the suffix. */
const only = <T extends { name: string }>(rows: T[], name: string) =>
  rows.filter((r) => r.name === tag(name));

// ─── Dish candidates ─────────────────────────────────────────────────────────

describe('loadRelogDishCandidates', () => {
  it('ranks a frequent staple above a fresher one-off on an empty query', async () => {
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, ''));
      expect(found).toContain('Cà phê sữa đá');
      expect(found).toContain('Bún chả');
      // 5 occurrences beats 1 occurrence logged today.
      expect(found.indexOf('Cà phê sữa đá')).toBeLessThan(
        found.indexOf('Bún chả')
      );
    });
  });

  it('finds a diacritic name from an ASCII query', async () => {
    await withHistory(async (tx) => {
      expect(names(await dishes(tx, 'pho bo'))).toContain('Phở bò');
    });
  });

  it('matches mid-string, not just prefixes', async () => {
    await withHistory(async (tx) => {
      // "sữa" sits in the middle of "Cà phê sữa đá".
      expect(names(await dishes(tx, 'sữa'))).toContain('Cà phê sữa đá');
    });
  });

  it('does NOT return a "bơ" dish for a "bò" query', async () => {
    // The load-bearing-diacritics regression: bò=beef, bơ=butter. A diacritic
    // query must never be folded against unaccented data.
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, 'bò'));
      expect(found).toContain('Phở bò');
      expect(found).not.toContain('Bơ đậu phộng');
    });
  });

  it('does NOT return a "bò" dish for a "bơ" query', async () => {
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, 'bơ'));
      expect(found).toContain('Bơ đậu phộng');
      expect(found).not.toContain('Phở bò');
    });
  });

  it('deliberately matches both from the ASCII "bo" — folding is one-way', async () => {
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, 'bo'));
      expect(found).toContain('Phở bò');
      expect(found).toContain('Bơ đậu phộng');
    });
  });

  it('sorts prefix matches above mid-string matches', async () => {
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, 'tra'));
      expect(found).toContain('Trà đá');
      expect(found).toContain('Sữa trà xanh');
      expect(found.indexOf('Trà đá')).toBeLessThan(
        found.indexOf('Sữa trà xanh')
      );
    });
  });

  it('collapses a repeated dish to one row and counts the occurrences', async () => {
    await withHistory(async (tx) => {
      const pho = only(await dishes(tx, 'Phở bò'), 'Phở bò');
      expect(pho).toHaveLength(1);
      expect(pho[0].occurrenceCount).toBe(3);
    });
  });

  it('takes the payload from the most recent occurrence', async () => {
    await withHistory(async (tx) => {
      const [pho] = only(await dishes(tx, 'Phở bò'), 'Phở bò');
      // The 1-day-old instance is 400 kcal / 500 g; the 5-day-old one is
      // 999 kcal / 900 g and must NOT be the one offered.
      expect(pho.caloriesKcal).toBeCloseTo(400, 5);
      expect(pho.totalGrams).toBeCloseTo(500, 3);
      expect(pho.ingredientCount).toBe(2);
    });
  });

  it('excludes cheat meals, split portions, and rows past the window', async () => {
    await withHistory(async (tx) => {
      const found = names(await dishes(tx, ''));
      expect(found).not.toContain('Phở gà'); // portion_factor = 0.5
      expect(found).not.toContain('Món cũ'); // 400 days old
      expect(found).not.toContain('tiệc nướng'); // cheat, no item rows
    });
  });

  it('returns nothing for a bare % — LIKE wildcards are escaped', async () => {
    await withHistory(async (tx) => {
      expect(names(await dishes(tx, '%'))).toHaveLength(0);
      expect(names(await dishes(tx, '_'))).toHaveLength(0);
    });
  });

  it('never leaks another user’s history', async () => {
    await withHistory(async (tx) => {
      const found = await loadRelogDishCandidates(tx, {
        userId: STRANGER,
        query: '',
        limit: 20,
      });
      expect(found).toHaveLength(0);
    });
  });

  it('honours the limit', async () => {
    await withHistory(async (tx) => {
      expect(await dishes(tx, '', 2)).toHaveLength(2);
    });
  });
});

// ─── Meal candidates ─────────────────────────────────────────────────────────

describe('loadRelogMealCandidates', () => {
  it('finds a meal from an ASCII query and reports its dish count', async () => {
    await withHistory(async (tx) => {
      const [meal] = only(await mealsFor(tx, 'pho bo'), 'phở bò với trà đá');
      expect(meal).toBeDefined();
      expect(meal.dishCount).toBe(2);
      // Summed from the item rows: 400 (Phở bò) + 10 (Trà đá).
      expect(meal.caloriesKcal).toBeCloseTo(410, 5);
    });
  });

  it('applies the same diacritic routing as the dish query', async () => {
    await withHistory(async (tx) => {
      const found = names(await mealsFor(tx, 'bò'));
      expect(found).toContain('phở bò');
      expect(found).not.toContain('bánh mì bơ');
    });
  });

  it('lists differently-punctuated meals separately — the accepted weak dedup', async () => {
    // raw_input is free text, so these do NOT collapse the way dish names do.
    // Pinned so that changing it later is a deliberate decision, not a drift.
    await withHistory(async (tx) => {
      const found = names(await mealsFor(tx, 'pho bo'));
      expect(found).toContain('phở bò với trà đá');
      expect(found).toContain('phở bò + trà đá');
    });
  });

  it('never surfaces a meal with no item rows', async () => {
    await withHistory(async (tx) => {
      expect(names(await mealsFor(tx, ''))).not.toContain('tiệc nướng');
    });
  });

  it('excludes split portions and rows past the window', async () => {
    await withHistory(async (tx) => {
      const found = names(await mealsFor(tx, ''));
      expect(found).not.toContain('phở gà chia đôi');
      expect(found).not.toContain('món cũ');
    });
  });

  it('returns nothing for a bare %', async () => {
    await withHistory(async (tx) => {
      expect(names(await mealsFor(tx, '%'))).toHaveLength(0);
    });
  });

  it('never leaks another user’s history', async () => {
    await withHistory(async (tx) => {
      const found = await loadRelogMealCandidates(tx, {
        userId: STRANGER,
        query: '',
        limit: 20,
      });
      expect(found).toHaveLength(0);
    });
  });
});
