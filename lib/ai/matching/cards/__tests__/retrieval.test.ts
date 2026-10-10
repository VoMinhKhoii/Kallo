import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/matching/candidate', () => ({
  attachCandidateNutrition: vi.fn(async () => {}),
}));

import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';
import { __resetCardCatalogForTests, getCardCatalog } from '../catalog';
import { cardLabel } from '../label';
import { createCardEmbeddingPrewarm } from '../prewarm';
import { cardQueryStrings } from '../query-strings';
import { matchCardCandidates } from '../retrieval';

const ROWS = [
  {
    id: 'usda_brisket_choice',
    source_code: 'USDA_SR',
    state: 'raw',
    name_en: 'Beef, brisket, flat half, choice, raw',
    name_primary: 'Ức bò',
    food: 'beef brisket, flat half, raw',
    aliases_en: ['brisket'],
    names_vi: ['ức bò'],
    part_cut: 'brisket',
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
  {
    id: 'usda_brisket_select',
    source_code: 'USDA_SR',
    state: 'raw',
    name_en: 'Beef, brisket, flat half, select, raw',
    name_primary: 'Ức bò',
    food: 'beef brisket, flat half, raw',
    aliases_en: ['brisket'],
    names_vi: ['ức bò'],
    part_cut: 'brisket',
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
  {
    id: 'fao_beef',
    source_code: 'FAO_VN_2007',
    state: 'raw',
    name_en: 'Beef',
    name_primary: 'Thịt bò',
    food: 'beef, raw',
    aliases_en: ['beef'],
    names_vi: ['thịt bò'],
    part_cut: null,
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
  {
    id: 'usda_brisket_cooked',
    source_code: 'USDA_SR',
    state: 'cooked',
    name_en: 'Beef, brisket, flat half, braised',
    name_primary: 'Ức bò hầm',
    food: 'beef brisket, braised',
    aliases_en: [],
    names_vi: ['ức bò hầm'],
    part_cut: 'brisket',
    form_processing: null,
    cooking_method: 'braised',
    fat_level: null,
    brand: null,
  },
  {
    id: 'usda_chicken_skin',
    source_code: 'USDA_SR',
    state: 'raw',
    name_en: 'Chicken, broilers or fryers, skin only, raw',
    name_primary: 'Da gà',
    food: 'chicken skin, raw',
    aliases_en: ['chicken skin'],
    names_vi: ['da gà'],
    part_cut: 'skin',
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
  {
    id: 'usda_chicken_breast',
    source_code: 'USDA_SR',
    state: 'raw',
    name_en: 'Chicken, broilers or fryers, breast, meat only, raw',
    name_primary: 'Ức gà',
    food: 'chicken breast, raw',
    aliases_en: ['chicken breast'],
    names_vi: ['ức gà'],
    part_cut: 'breast',
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
];

function mockDb(
  ready: boolean,
  hits: {
    query_index: number;
    food_composition_id: string;
    similarity: number;
  }[],
  rows: readonly object[] = ROWS
) {
  const execute = vi.fn(async (q: unknown) => {
    const text = JSON.stringify(q);
    if (text.includes('to_regclass')) return [{ present: ready }];
    if (text.includes('embedding IS NULL')) return [{ ready }];
    if (text.includes('match_food_cards')) return hits;
    return rows;
  });
  // The catalog reads readiness and rows inside one transaction.
  const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ execute })
  );
  return { execute, transaction } as unknown as AppDb;
}

const gemini = {
  generateEmbeddingBatch: vi.fn(async (texts: string[]) =>
    texts.map(() => [0.1, 0.2])
  ),
} as unknown as GeminiClient;

const ing: DecomposedIngredientV2 = {
  rawName: 'Ức bò',
  canonicalName: 'Beef brisket',
  queryEn: 'beef brisket flat half raw',
  nameVi: 'ức bò',
  tableName: 'Beef, brisket, flat half, raw',
};

beforeEach(() => {
  __resetCardCatalogForTests();
  vi.clearAllMocks();
});

describe('matchCardCandidates', () => {
  it('returns null while the card index is not ready', async () => {
    expect(
      await matchCardCandidates([ing], mockDb(false, []), gemini)
    ).toBeNull();
  });

  it('fuses the arms, keeps one row per concept and labels candidates', async () => {
    const hits = [0, 1, 2, 3].flatMap((q) => [
      {
        query_index: q + 1,
        food_composition_id: 'usda_brisket_choice',
        similarity: 0.91,
      },
      {
        query_index: q + 1,
        food_composition_id: 'usda_brisket_select',
        similarity: 0.9,
      },
      { query_index: q + 1, food_composition_id: 'fao_beef', similarity: 0.8 },
    ]);
    const [result] =
      (await matchCardCandidates([ing], mockDb(true, hits), gemini)) ?? [];
    const ids = result.candidates.map((c) => c.info.foodCompositionId);
    expect(ids).toContain('usda_brisket_choice');
    expect(ids).not.toContain('usda_brisket_select'); // same concept as choice
    expect(ids).toContain('fao_beef'); // sources compete equally
    const top = result.candidates[0].info;
    expect(top.matchedName).toBe('Ức bò'); // the row's own name, not the label
    expect(result.candidates[0].prompt.name).toContain(
      '[row: Beef, brisket, flat half, choice, raw]'
    );
    expect(top.similarity).toBeCloseTo(0.91);
  });

  it('embeds the four query strings per ingredient in order', async () => {
    await matchCardCandidates([ing], mockDb(true, []), gemini);
    expect(gemini.generateEmbeddingBatch).toHaveBeenCalledWith(
      cardQueryStrings(ing)
    );
    expect(cardQueryStrings({ rawName: 'a', canonicalName: 'b' })).toEqual([
      'a',
      'b',
      'b',
      'a',
    ]);
  });

  it('keeps the lexical arms when the vector arm fails', async () => {
    const failing = {
      generateEmbeddingBatch: vi.fn(async () => {
        throw new Error('embedding API down');
      }),
    } as unknown as GeminiClient;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [result] =
      (await matchCardCandidates([ing], mockDb(true, []), failing)) ?? [];
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('applies the legacy eligibility guards (no skin-only row for a meat query)', async () => {
    const chicken: DecomposedIngredientV2 = {
      rawName: 'Ức gà',
      canonicalName: 'Chicken breast',
    };
    const hits = [
      {
        query_index: 1,
        food_composition_id: 'usda_chicken_skin',
        similarity: 0.95,
      },
      {
        query_index: 1,
        food_composition_id: 'usda_chicken_breast',
        similarity: 0.9,
      },
    ];
    const [result] =
      (await matchCardCandidates([chicken], mockDb(true, hits), gemini)) ?? [];
    const ids = result.candidates.map((c) => c.info.foodCompositionId);
    expect(ids).toContain('usda_chicken_breast');
    expect(ids).not.toContain('usda_chicken_skin');
  });

  it('falls back to the lexical arms when the vector arm stalls', async () => {
    vi.useFakeTimers();
    const stalled = {
      generateEmbeddingBatch: vi.fn(() => new Promise<number[][]>(() => {})),
    } as unknown as GeminiClient;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = matchCardCandidates([ing], mockDb(true, []), stalled);
    await vi.advanceTimersByTimeAsync(4_000);
    const [result] = (await pending) ?? [];
    expect(result.candidates.length).toBeGreaterThan(0);
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('starts no vector query once the vector arm has timed out', async () => {
    vi.useFakeTimers();
    let land: (v: number[][]) => void = () => {};
    const late = {
      generateEmbeddingBatch: vi.fn(
        (texts: string[]) =>
          new Promise<number[][]>((resolve) => {
            land = () => resolve(texts.map(() => [0.1, 0.2]));
          })
      ),
    } as unknown as GeminiClient;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = mockDb(true, []);
    const pending = matchCardCandidates([ing], db, late);
    await vi.advanceTimersByTimeAsync(4_000);
    await pending;
    land([]);
    await vi.advanceTimersByTimeAsync(10);
    const vectorQueries = vi
      .mocked(db.execute)
      .mock.calls.filter(([q]) =>
        JSON.stringify(q).includes('match_food_cards')
      );
    expect(vectorQueries).toHaveLength(0);
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps the salt variant the user asked for when siblings collapse', async () => {
    const peanut = (id: string, salt: string) => ({
      ...ROWS[0],
      id,
      name_en: `Peanuts, all types, dry-roasted, ${salt}`,
      name_primary: 'Đậu phộng rang',
      food: 'peanuts, dry-roasted',
      aliases_en: ['roasted peanuts'],
      names_vi: ['đậu phộng rang'],
      part_cut: null,
    });
    const rows = [
      peanut('usda_peanut_salt', 'with salt'),
      peanut('usda_peanut_nosalt', 'without salt'),
    ];
    // The salted row ranks first on every vector arm.
    const hits = [0, 1, 2, 3].flatMap((q) => [
      {
        query_index: q,
        food_composition_id: 'usda_peanut_salt',
        similarity: 0.92,
      },
      {
        query_index: q,
        food_composition_id: 'usda_peanut_nosalt',
        similarity: 0.9,
      },
    ]);
    const unsalted: DecomposedIngredientV2 = {
      rawName: 'Đậu phộng rang không muối',
      canonicalName: 'Peanuts, unsalted',
      queryEn: 'unsalted dry roasted peanuts',
      nameVi: 'đậu phộng rang không muối',
      tableName: 'Peanuts, dry-roasted, without salt',
    };
    const [result] =
      (await matchCardCandidates(
        [unsalted],
        mockDb(true, hits, rows),
        gemini
      )) ?? [];
    const ids = result.candidates.map((c) => c.info.foodCompositionId);
    expect(ids).toContain('usda_peanut_nosalt');
    expect(ids).not.toContain('usda_peanut_salt');
  });

  it('probes for the card tables before any query that names them', async () => {
    const db = mockDb(false, []);
    expect(await getCardCatalog(db)).toBeNull();
    const texts = vi
      .mocked(db.execute)
      .mock.calls.map(([q]) => JSON.stringify(q));
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('to_regclass');
  });

  it('re-reads a ready catalog after 30 minutes and hands back to legacy mid-backfill', async () => {
    vi.useFakeTimers();
    let ready = true;
    const execute = vi.fn(async (q: unknown) => {
      const text = JSON.stringify(q);
      if (text.includes('to_regclass')) return [{ present: true }];
      if (text.includes('embedding IS NULL')) return [{ ready }];
      return ROWS;
    });
    const db = {
      execute,
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({ execute })
      ),
    } as unknown as AppDb;

    expect(await getCardCatalog(db)).not.toBeNull();
    // A card migration lands; its new strings are not embedded yet.
    ready = false;
    vi.advanceTimersByTime(29 * 60_000);
    expect(await getCardCatalog(db)).not.toBeNull(); // still fresh: no re-read
    vi.advanceTimersByTime(2 * 60_000);
    expect(await getCardCatalog(db)).not.toBeNull(); // serves while re-reading
    await vi.runAllTimersAsync();
    expect(await getCardCatalog(db)).toBeNull(); // legacy until the backfill ends
    vi.useRealTimers();
  });

  it('retries a failed refresh after a minute, keeping the loaded catalog meanwhile', async () => {
    vi.useFakeTimers();
    let failing = false;
    const execute = vi.fn(async (q: unknown) => {
      const text = JSON.stringify(q);
      if (failing) throw new Error('connection reset');
      if (text.includes('to_regclass')) return [{ present: true }];
      if (text.includes('embedding IS NULL')) return [{ ready: true }];
      return ROWS;
    });
    const db = {
      execute,
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({ execute })
      ),
    } as unknown as AppDb;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await getCardCatalog(db)).not.toBeNull();
    failing = true;
    vi.advanceTimersByTime(31 * 60_000);
    expect(await getCardCatalog(db)).not.toBeNull(); // the refresh fails
    await vi.runAllTimersAsync();
    const callsAfterFailure = execute.mock.calls.length;
    failing = false;
    vi.advanceTimersByTime(61_000);
    expect(await getCardCatalog(db)).not.toBeNull(); // retried after a minute
    await vi.runAllTimersAsync();
    expect(execute.mock.calls.length).toBeGreaterThan(callsAfterFailure);
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('drops opposite-state rows when the user stated the weighing basis', async () => {
    const hits = [
      {
        query_index: 1,
        food_composition_id: 'usda_brisket_cooked',
        similarity: 0.95,
      },
      {
        query_index: 1,
        food_composition_id: 'usda_brisket_choice',
        similarity: 0.9,
      },
    ];
    const [result] =
      (await matchCardCandidates(
        [{ ...ing, stateHint: 'raw_weight' }],
        mockDb(true, hits),
        gemini
      )) ?? [];
    expect(result.candidates.map((c) => c.info.state)).not.toContain('cooked');
  });

  it('fills the list with stated-state rows ranked below eight opposite-state ones', async () => {
    const cooked = Array.from({ length: 8 }, (_, i) => ({
      ...ROWS[3],
      id: `usda_cooked_${i}`,
      name_en: `Beef, brisket, cut ${i}, braised`,
    }));
    const rows = [...cooked, ROWS[0]];
    const hits = rows.map((r, i) => ({
      query_index: 1,
      food_composition_id: r.id,
      similarity: 0.95 - i * 0.01,
    }));
    // Names no row shares, so only the vector arm ranks (lexical arms stay empty).
    const vectorOnly: DecomposedIngredientV2 = {
      rawName: 'Zzq',
      canonicalName: 'Zzq',
      stateHint: 'raw_weight',
    };
    const [result] =
      (await matchCardCandidates(
        [vectorOnly],
        mockDb(true, hits, rows),
        gemini
      )) ?? [];
    expect(result.candidates.map((c) => c.info.foodCompositionId)).toEqual([
      'usda_brisket_choice',
    ]);
  });
});

describe('cardLabel', () => {
  it('shows food, facets, VI name and the row name', () => {
    expect(
      cardLabel({
        id: 'x',
        source: 'usda',
        state: 'raw',
        nameEn: 'Peppers, serrano, raw',
        namePrimary: 'Ớt',
        concept: '',
        card: {
          food: 'serrano pepper, raw',
          namesVi: ['ớt serrano'],
          facets: ['fresh'],
        },
      })
    ).toBe(
      'serrano pepper, raw, fresh / ớt serrano [row: Peppers, serrano, raw]'
    );
  });
});

describe('createCardEmbeddingPrewarm', () => {
  it('embeds completed query strings once, capitalized like the decomposition', () => {
    const embed = vi.fn(async (t: string[]) => t.map(() => [0]));
    const prewarm = createCardEmbeddingPrewarm({
      generateEmbeddingBatch: embed,
    } as unknown as GeminiClient);
    prewarm(
      '{"mealItems":[{"ingredients":[{"rawName":"ức bò","canonicalName":"beef brisket","queryEn":"beef bri'
    );
    expect(embed).toHaveBeenLastCalledWith(['Ức bò', 'Beef brisket']);
    prewarm(
      '{"mealItems":[{"ingredients":[{"rawName":"ức bò","canonicalName":"beef brisket","queryEn":"beef brisket raw","nameVi":"ức bò"}'
    );
    expect(embed).toHaveBeenLastCalledWith(['beef brisket raw', 'ức bò']);
    expect(embed).toHaveBeenCalledTimes(2);
  });
});
