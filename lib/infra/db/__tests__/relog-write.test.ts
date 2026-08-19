/**
 * End-to-end tests for `relogMealItemsAction` against a live Postgres.
 *
 * The writer's whole job is faithfulness — copy stored rows verbatim, sum the
 * meal from those rows, re-sequence dish order, refuse ineligible sources — and
 * none of that is provable against a mocked query builder. So only `@/lib/infra/auth/session`
 * is mocked here; the transaction, the `FOR UPDATE` lock, the inserts and the
 * numeric round-trip are real.
 *
 * Requires: DATABASE_URL in .env.local, plus `meals`, `meal_items`,
 * `meal_shares`, `user_profiles` and at least one `auth.users` row.
 *
 * Run: bun --env-file=.env.local vitest run lib/db/__tests__/relog-write.test.ts
 */
import { inArray, sql } from 'drizzle-orm';
import postgres from 'postgres';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe as describeBase,
  expect,
  it,
  vi,
} from 'vitest';
import { relogMealItemsAction } from '@/lib/actions/meals/relog/relog-items';
import { db, encodeDbUrl } from '@/lib/infra/db/client';
import { meals } from '@/lib/infra/db/schema';

// ─── Prerequisite probe ──────────────────────────────────────────────────────

async function resolveSeedUserId(databaseUrl: string): Promise<string | null> {
  const client = postgres(encodeDbUrl(databaseUrl), { prepare: false, max: 1 });
  try {
    const rows = await client<{ id: string }[]>`
      SELECT id FROM auth.users LIMIT 1
    `;
    if (rows.length === 0) return null;
    await client`SELECT 1 FROM meal_items LIMIT 1`;
    await client`SELECT 1 FROM meal_shares LIMIT 1`;
    await client`SELECT 1 FROM user_profiles LIMIT 1`;
    return rows[0].id;
  } catch {
    return null;
  } finally {
    await client.end();
  }
}

/**
 * OPT-IN, and deliberately so — this file is the only one here that COMMITS.
 *
 * relog-candidates.test.ts seeds inside a rolled-back transaction, but the
 * action under test opens its own `db.transaction` and so cannot be nested in
 * an outer one. Committing means real writes for a borrowed `auth.users` row,
 * and `insertDefaultCircleShare` fires the AFTER INSERT trigger that fans a
 * `meal_shared` event into that account's circle feed. Rows are cleaned up per
 * test, but a fan-out is not something a test run should do to a real account.
 *
 * Point DATABASE_URL at a scratch database you own, then set RELOG_WRITE_TEST=1
 * to acknowledge it. Without the flag this file skips, so the documented
 * `vitest run lib/db/__tests__/` against a real project stays safe.
 */
const databaseUrl = process.env.DATABASE_URL;
const optedIn = process.env.RELOG_WRITE_TEST === '1';
const seedUserId =
  databaseUrl && optedIn ? await resolveSeedUserId(databaseUrl) : null;
const describe = seedUserId ? describeBase : describeBase.skip;

const OWNER = seedUserId ?? '00000000-0000-0000-0000-000000000001';
const STRANGER = '00000000-0000-0000-0000-0000000000ff';
let actingUserId = OWNER;

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn(async () => ({
    user: { id: actingUserId, email: 'relog@test.local' },
    profile: { goal: 'maintaining', aggression: null },
  })),
}));

// The module under test is imported statically above; `vi.mock` is hoisted
// above imports, so the auth stub is in place before it loads. (A top-level
// `await import()` here instead breaks module init under `bun … vitest`.)

// ─── Fixtures ────────────────────────────────────────────────────────────────

const createdMealIds: string[] = [];

interface SeedDish {
  name: string;
  ingredients: {
    name: string;
    grams: number | null;
    kcal: number | null;
    ironMg?: number | null;
    unit?: string | null;
    confidence?: number | null;
    compositionId?: string | null;
  }[];
}

async function seedMeal(opts: {
  rawInput: string;
  dishes: SeedDish[];
  entryMode?: string;
  portionFactor?: number;
  confidence?: string | null;
  userId?: string;
  /** Deliberately wrong meal-level totals, to prove the writer ignores them. */
  mealKcal?: number;
}): Promise<string> {
  // RETURNING id — `meals.id` is the uuid primary key, so exactly one non-null
  // string comes back per inserted row.
  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO meals (user_id, raw_input, logged_at, entry_mode,
                       portion_factor, confidence_overall, calories_kcal)
    VALUES (${opts.userId ?? OWNER}, ${opts.rawInput}, now(),
            ${opts.entryMode ?? 'precise'}, ${opts.portionFactor ?? 1},
            ${opts.confidence === undefined ? 'high' : opts.confidence},
            ${opts.mealKcal ?? 99999})
    RETURNING id
  `);
  const mealId = String(rows[0].id);
  createdMealIds.push(mealId);

  for (const [order, dish] of opts.dishes.entries()) {
    for (const ing of dish.ingredients) {
      await db.execute(sql`
        INSERT INTO meal_items (
          meal_id, ingredient_name, meal_item_name, meal_item_order,
          estimated_grams, user_facing_unit, cooking_method, match_confidence,
          food_composition_id, calories_kcal, iron_mg
        ) VALUES (
          ${mealId}, ${ing.name}, ${dish.name}, ${order},
          ${ing.grams}, ${ing.unit ?? null}, 'luộc',
          ${ing.confidence ?? 0.42}, ${ing.compositionId ?? null},
          ${ing.kcal}, ${ing.ironMg ?? null}
        )
      `);
    }
  }
  return mealId;
}

const TODAY = new Date().toISOString().slice(0, 10);
const commit = (items: Parameters<typeof relogMealItemsAction>[0]['items']) =>
  relogMealItemsAction({ items, loggedDate: TODAY, timezoneOffset: 0 });

async function itemRows(mealId: string) {
  const rows = await db.execute(sql`
    SELECT meal_item_order, meal_item_name, ingredient_name, estimated_grams,
           user_facing_unit, cooking_method, match_confidence,
           food_composition_id, calories_kcal, iron_mg
    FROM meal_items WHERE meal_id = ${mealId}
    ORDER BY meal_item_order, ingredient_name
  `);
  // The ten columns are asserted by name below and each is coerced at its use
  // site, so the untyped-row default `db.execute()` already returns is exactly
  // the right shape here.
  return rows;
}

if (seedUserId) {
  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO user_profiles (user_id, auto_share_to_circle)
      VALUES (${OWNER}, true)
      ON CONFLICT (user_id) DO NOTHING
    `);
  });
  afterEach(async () => {
    actingUserId = OWNER;
    await deleteCreatedMeals();
  });
  afterAll(async () => {
    // Defensive only — afterEach already drains the list. Scoped to ids this
    // file created, NEVER to `user_id`: the seed user is a real borrowed
    // account, and a user-scoped delete would wipe their actual meal history.
    await deleteCreatedMeals();
  });
}

/** Drop every meal this file created, by id. meal_items and meal_shares go
 *  with them via ON DELETE CASCADE. */
async function deleteCreatedMeals() {
  if (createdMealIds.length === 0) return;
  const ids = [...createdMealIds];
  createdMealIds.length = 0;
  await db.delete(meals).where(inArray(meals.id, ids));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('relogMealItemsAction', () => {
  it('copies a dish verbatim, including nulls and non-macro nutrients', async () => {
    const source = await seedMeal({
      rawInput: 'phở bò',
      dishes: [
        {
          name: 'Phở bò',
          ingredients: [
            {
              name: 'bánh phở',
              grams: 180,
              kcal: 250,
              ironMg: 1.5,
              unit: 'bát',
              confidence: 0.83,
              compositionId: null,
            },
            // grams and kcal null: unknown must stay unknown, never become 0.
            { name: 'hành lá', grams: null, kcal: null, ironMg: null },
          ],
        },
      ],
    });

    const result = await commit([
      { kind: 'dish', sourceMealId: source, mealItemOrder: 0 },
    ]);
    createdMealIds.push(result.mealId);

    const rows = await itemRows(result.mealId);
    expect(rows).toHaveLength(2);
    const banh = rows.find((r) => r.ingredient_name === 'bánh phở');
    expect(Number(banh?.estimated_grams)).toBeCloseTo(180, 3);
    expect(Number(banh?.calories_kcal)).toBeCloseTo(250, 5);
    expect(Number(banh?.iron_mg)).toBeCloseTo(1.5, 5);
    // Copied, NOT stamped with manual-mode values ('g' / 1).
    expect(banh?.user_facing_unit).toBe('bát');
    expect(Number(banh?.match_confidence)).toBeCloseTo(0.83, 5);
    expect(banh?.cooking_method).toBe('luộc');

    const hanh = rows.find((r) => r.ingredient_name === 'hành lá');
    expect(hanh?.estimated_grams).toBeNull();
    expect(hanh?.calories_kcal).toBeNull();
    expect(hanh?.iron_mg).toBeNull();
  });

  it('sums meal nutrition from the copied rows, ignoring the source meal total', async () => {
    const source = await seedMeal({
      rawInput: 'bữa lớn',
      // The source meal claims 99999 kcal across BOTH dishes; relogging only
      // the first must produce 300, not the stored total.
      mealKcal: 99999,
      dishes: [
        {
          name: 'Cơm gà',
          ingredients: [
            { name: 'cơm', grams: 200, kcal: 200 },
            { name: 'gà', grams: 100, kcal: 100 },
          ],
        },
        { name: 'Canh', ingredients: [{ name: 'rau', grams: 50, kcal: 20 }] },
      ],
    });

    const result = await commit([
      { kind: 'dish', sourceMealId: source, mealItemOrder: 0 },
    ]);
    createdMealIds.push(result.mealId);

    // `meals.calories_kcal` is a nullable `numeric`, which postgres-js hands
    // back as a string rather than a number (no silent precision loss).
    const [meal] = await db.execute<{ calories_kcal: string | null }>(sql`
      SELECT calories_kcal FROM meals WHERE id = ${result.mealId}
    `);
    expect(Number(meal.calories_kcal)).toBeCloseTo(300, 5);
    expect(result.meal.nutrition.caloriesKcal).toBeCloseTo(300, 5);
    // And the invariant holds: meals.* equals the sum of its own item rows.
    const rows = await itemRows(result.mealId);
    const rowSum = rows.reduce((n, r) => n + Number(r.calories_kcal), 0);
    expect(Number(meal.calories_kcal)).toBeCloseTo(rowSum, 5);
  });

  it('expands a meal ref into all of its dishes', async () => {
    const source = await seedMeal({
      rawInput: 'phở bò với trà đá',
      dishes: [
        {
          name: 'Phở bò',
          ingredients: [{ name: 'bánh phở', grams: 180, kcal: 400 }],
        },
        {
          name: 'Trà đá',
          ingredients: [{ name: 'trà', grams: 200, kcal: 10 }],
        },
      ],
    });

    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);

    expect(result.meal.mealItemGroups.map((g) => g.name)).toEqual([
      'Phở bò',
      'Trà đá',
    ]);
    expect(result.meal.mealItemGroups.map((g) => g.order)).toEqual([0, 1]);
  });

  it('re-sequences dish order so two picks of the same dish stay separate', async () => {
    // Both source dishes sit at meal_item_order 0. Without re-sequencing,
    // buildMealItemGroupsFromRows keys on `${order}:${name}` and would MERGE
    // them into one group — silently halving what the user logged.
    const a = await seedMeal({
      rawInput: 'phở bò',
      dishes: [
        {
          name: 'Phở bò',
          ingredients: [{ name: 'bánh phở', grams: 180, kcal: 400 }],
        },
      ],
    });
    const b = await seedMeal({
      rawInput: 'phở bò lần hai',
      dishes: [
        {
          name: 'Phở bò',
          ingredients: [{ name: 'bánh phở', grams: 200, kcal: 450 }],
        },
      ],
    });

    const result = await commit([
      { kind: 'dish', sourceMealId: a, mealItemOrder: 0 },
      { kind: 'dish', sourceMealId: b, mealItemOrder: 0 },
    ]);
    createdMealIds.push(result.mealId);

    expect(result.meal.mealItemGroups).toHaveLength(2);
    expect(result.meal.mealItemGroups.map((g) => g.order)).toEqual([0, 1]);
    expect(result.meal.nutrition.caloriesKcal).toBeCloseTo(850, 5);
    const orders = (await itemRows(result.mealId)).map(
      (r) => r.meal_item_order
    );
    expect(orders.map(Number)).toEqual([0, 1]);
  });

  it('flattens a mixed meal+dish stage in the staged order', async () => {
    const a = await seedMeal({
      rawInput: 'bữa sáng',
      dishes: [
        {
          name: 'Bánh mì',
          ingredients: [{ name: 'bánh', grams: 100, kcal: 300 }],
        },
        {
          name: 'Cà phê',
          ingredients: [{ name: 'cà phê', grams: 120, kcal: 140 }],
        },
      ],
    });
    const b = await seedMeal({
      rawInput: 'trà đá',
      dishes: [
        {
          name: 'Trà đá',
          ingredients: [{ name: 'trà', grams: 200, kcal: 10 }],
        },
      ],
    });

    const result = await commit([
      { kind: 'dish', sourceMealId: b, mealItemOrder: 0 },
      { kind: 'meal', sourceMealId: a },
    ]);
    createdMealIds.push(result.mealId);

    expect(result.meal.mealItemGroups.map((g) => g.name)).toEqual([
      'Trà đá',
      'Bánh mì',
      'Cà phê',
    ]);
    expect(result.meal.mealItemGroups.map((g) => g.order)).toEqual([0, 1, 2]);
  });

  it('labels the meal from the staged dish names', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        {
          name: 'Phở bò',
          ingredients: [{ name: 'bánh phở', grams: 180, kcal: 400 }],
        },
        {
          name: 'Trà đá',
          ingredients: [{ name: 'trà', grams: 200, kcal: 10 }],
        },
      ],
    });
    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);
    expect(result.meal.rawInput).toBe('Phở bò, Trà đá');
  });

  it('takes the weakest confidence across contributing source meals', async () => {
    const high = await seedMeal({
      rawInput: 'a',
      confidence: 'high',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    const low = await seedMeal({
      rawInput: 'b',
      confidence: 'low',
      dishes: [
        { name: 'B', ingredients: [{ name: 'b', grams: 10, kcal: 10 }] },
      ],
    });

    const result = await commit([
      { kind: 'dish', sourceMealId: high, mealItemOrder: 0 },
      { kind: 'dish', sourceMealId: low, mealItemOrder: 0 },
    ]);
    createdMealIds.push(result.mealId);
    // Not 'high' — re-logging must never upgrade a low-confidence estimate.
    expect(result.meal.confidenceOverall).toBe('low');
  });

  it('stamps a fresh precise meal rather than copying source metadata', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);
    expect(result.meal.entryMode).toBe('precise');
    expect(result.meal.portionFactor).toBe(1);
    expect(result.meal.alcoholG).toBeNull();
    expect(result.meal.mealSlot).toBeTruthy();
  });

  it('honours a client-supplied meal id so the optimistic card keeps its key', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    const newMealId = crypto.randomUUID();
    const result = await relogMealItemsAction({
      newMealId,
      items: [{ kind: 'meal', sourceMealId: source }],
      loggedDate: TODAY,
      timezoneOffset: 0,
    });
    createdMealIds.push(result.mealId);
    expect(result.mealId).toBe(newMealId);
  });

  it('refuses a source meal belonging to someone else', async () => {
    const source = await seedMeal({
      rawInput: 'của người khác',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    // Same rows, different caller — the user_id predicate is the real boundary
    // because Drizzle runs on the owner connection and bypasses RLS.
    actingUserId = STRANGER;
    await expect(
      commit([{ kind: 'meal', sourceMealId: source }])
    ).rejects.toThrow(/không thuộc về bạn/);
  });

  it('refuses a cheat source', async () => {
    const source = await seedMeal({
      rawInput: 'tiệc',
      entryMode: 'cheat',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    await expect(
      commit([{ kind: 'meal', sourceMealId: source }])
    ).rejects.toThrow(/bữa xả/);
  });

  it('refuses a split-portion source, whose rows are already halved', async () => {
    const source = await seedMeal({
      rawInput: 'chia đôi',
      portionFactor: 0.5,
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    await expect(
      commit([{ kind: 'meal', sourceMealId: source }])
    ).rejects.toThrow(/chia đôi/);
  });

  it('refuses a dish ref that no longer resolves, writing nothing', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    // `count(*)::int AS n` — never null, and the ::int cast is what makes it
    // arrive as a JS number instead of a bigint string.
    const countRows = (): Promise<{ n: number }[]> =>
      db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM meals WHERE user_id = ${OWNER}`
      );
    const before = await countRows();
    await expect(
      commit([{ kind: 'dish', sourceMealId: source, mealItemOrder: 7 }])
    ).rejects.toThrow(/không còn trong lịch sử/);
    const after = await countRows();
    // The transaction rolled back — no orphan meal row.
    expect(after[0].n).toBe(before[0].n);
  });

  it('refuses a source meal that does not exist at all', async () => {
    await expect(
      commit([{ kind: 'meal', sourceMealId: crypto.randomUUID() }])
    ).rejects.toThrow(/không tồn tại|không thuộc về bạn/);
  });

  it('preserves a null food_composition_id without re-deriving nutrition', async () => {
    const source = await seedMeal({
      rawInput: 'mất liên kết',
      dishes: [
        {
          name: 'Món lạ',
          ingredients: [
            { name: 'x', grams: 50, kcal: 123, compositionId: null },
          ],
        },
      ],
    });
    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);
    const [row] = await itemRows(result.mealId);
    expect(row.food_composition_id).toBeNull();
    expect(Number(row.calories_kcal)).toBeCloseTo(123, 5);
  });

  it('shares to circle by default and reports the share', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
      ],
    });
    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);
    expect(result.meal.share?.visibility).toBe('circle');
  });

  it('respects the auto-share opt-out', async () => {
    await db.execute(sql`
      UPDATE user_profiles SET auto_share_to_circle = false
      WHERE user_id = ${OWNER}
    `);
    try {
      const source = await seedMeal({
        rawInput: 'nguồn',
        dishes: [
          { name: 'A', ingredients: [{ name: 'a', grams: 10, kcal: 10 }] },
        ],
      });
      const result = await commit([{ kind: 'meal', sourceMealId: source }]);
      createdMealIds.push(result.mealId);
      expect(result.meal.share).toBeNull();
    } finally {
      await db.execute(sql`
        UPDATE user_profiles SET auto_share_to_circle = true
        WHERE user_id = ${OWNER}
      `);
    }
  });

  it('returns groups whose nutrition is the sum of their ingredients', async () => {
    const source = await seedMeal({
      rawInput: 'nguồn',
      dishes: [
        {
          name: 'Cơm gà',
          ingredients: [
            { name: 'cơm', grams: 200, kcal: 200 },
            { name: 'gà', grams: 100, kcal: 150 },
          ],
        },
      ],
    });
    const result = await commit([{ kind: 'meal', sourceMealId: source }]);
    createdMealIds.push(result.mealId);
    const [group] = result.meal.mealItemGroups;
    expect(group.ingredients).toHaveLength(2);
    expect(group.nutrition.caloriesKcal).toBeCloseTo(350, 5);
    // Ingredient ids are freshly minted, never reused from the source rows.
    expect(new Set(group.ingredients.map((i) => i.id)).size).toBe(2);
  });
});
