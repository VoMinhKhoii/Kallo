import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

// The real schema: it is pure table definitions, and the upsert builds its
// conflict clause from the table's actual columns.

import { PgDialect } from 'drizzle-orm/pg-core';
import type { BarcodeProductRecord } from '@/lib/domain/barcode/types';
import { vietnameseFoodComposition } from '@/lib/infra/db/schema';
import {
  BARCODE_DATA_VERSION,
  barcodeCacheId,
  cacheBarcodeProduct,
  findCachedRow,
  findCachedRows,
  getBarcodeSourceIds,
  isStaleBarcodeRow,
  providerIdOfRow,
  rowToRecord,
} from '../cache';

function mockSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  mockDbSelect.mockReturnValue({ from });
  return { from, where, limit };
}

function cachedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off_8934563138162',
    namePrimary: '[Acecook] Hảo Hảo',
    caloriesKcal: 350,
    proteinG: 7.5,
    carbohydrateG: 52,
    fatG: 12,
    fiberG: 2,
    sodiumMg: 850,
    servingSizeG: '75',
    packageSizeG: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('barcodeCacheId', () => {
  it('prefixes the barcode per provider', () => {
    expect(barcodeCacheId('usda_fdc', '049000050103')).toBe('fdc_049000050103');
    expect(barcodeCacheId('off', '8934563138162')).toBe('off_8934563138162');
  });
});

describe('findCachedRow', () => {
  // One element of findCachedRows — these pin that the single read keeps the
  // same ranking rule rather than growing a second copy of it.
  it('looks every provider prefix up in a single query', async () => {
    const { from, where, limit } = mockSelect([]);

    await findCachedRow('8934563138162');

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(2);
  });

  it('prefers fdc_ over off_ regardless of returned row order', async () => {
    mockSelect([
      cachedRow({ id: 'off_049000050103' }),
      cachedRow({ id: 'fdc_049000050103' }),
    ]);

    const row = await findCachedRow('049000050103');
    expect(row?.id).toBe('fdc_049000050103');
  });

  it('still resolves a legacy off_-only row', async () => {
    mockSelect([cachedRow()]);

    const row = await findCachedRow('8934563138162');
    expect(row?.id).toBe('off_8934563138162');
  });

  it('is undefined when nothing is cached', async () => {
    mockSelect([]);
    await expect(findCachedRow('0000000000000')).resolves.toBeUndefined();
  });
});

describe('findCachedRows', () => {
  it('looks every barcode × provider up in a single query', async () => {
    const { limit } = mockSelect([]);

    await findCachedRows(['049000050103', '8934563138162']);

    // 2 barcodes × 2 providers. One round trip: a composer submit can carry 20
    // scanned picks, against a pool that defaults to two connections.
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(4);
  });

  it('collapses duplicate barcodes before querying', async () => {
    const { limit } = mockSelect([]);

    await findCachedRows(['8934563138162', '8934563138162']);

    expect(limit).toHaveBeenCalledWith(2);
  });

  it('runs no query at all for an empty list', async () => {
    mockSelect([]);

    await expect(findCachedRows([])).resolves.toEqual(new Map());
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('applies the provider rank PER barcode, not per returned row', async () => {
    // Postgres does not define row order for an `IN` list, so the winner is
    // chosen by rank in JS — here the off_ row is returned first for both.
    mockSelect([
      cachedRow({ id: 'off_049000050103' }),
      cachedRow({ id: 'off_8934563138162' }),
      cachedRow({ id: 'fdc_049000050103' }),
    ]);

    const rows = await findCachedRows(['049000050103', '8934563138162']);

    expect(rows.get('049000050103')?.id).toBe('fdc_049000050103');
    // Legacy off_-only rows still resolve, in the same batch.
    expect(rows.get('8934563138162')?.id).toBe('off_8934563138162');
  });

  it('omits a barcode nothing is cached under', async () => {
    mockSelect([cachedRow({ id: 'off_8934563138162' })]);

    const rows = await findCachedRows(['8934563138162', '0000000000000']);

    expect(rows.has('0000000000000')).toBe(false);
    expect(rows.size).toBe(1);
  });
});

describe('rowToRecord', () => {
  it('round-trips a bracketed brand out of the primary name', () => {
    const product = rowToRecord('8934563138162', cachedRow() as never);

    expect(product.brand).toBe('Acecook');
    expect(product.name).toBe('Hảo Hảo');
  });

  it('leaves the brand null for a bracket-less name', () => {
    const product = rowToRecord(
      '8934563138162',
      cachedRow({ namePrimary: 'Hảo Hảo' }) as never
    );

    expect(product.brand).toBeNull();
    expect(product.name).toBe('Hảo Hảo');
  });

  it('applies the 100kg cap and positivity rule on read', () => {
    const product = rowToRecord(
      '8934563138162',
      cachedRow({ servingSizeG: '500000', packageSizeG: '0' }) as never
    );

    expect(product.servingSizeG).toBeNull();
    expect(product.packageSizeG).toBeNull();
  });

  it('preserves nulls and coerces numeric strings', () => {
    const product = rowToRecord(
      '8934563138162',
      cachedRow({ fiberG: null, servingSizeG: '75' }) as never
    );

    expect(product.fiberG).toBeNull();
    expect(product.servingSizeG).toBe(75);
    expect(product.caloriesKcal).toBe(350);
  });

  it('reads a legacy row (no unit, no photo, no micros) as grams', () => {
    const product = rowToRecord('8934563138162', cachedRow() as never);

    expect(product.amountUnit).toBe('g');
    expect(product.sourceImageUrl).toBeNull();
    expect(product.micronutrients).toEqual({});
  });

  it('reads the unit, the stored micronutrients and a trusted photo', () => {
    const product = rowToRecord(
      '8938507849131',
      cachedRow({
        amountUnit: 'ml',
        calciumMg: '10',
        potassiumMg: '170',
        vitaminCMg: null,
        imageUrl:
          'https://images.openfoodfacts.org/images/products/893/850/784/9131/front_en.44.400.jpg',
      }) as never
    );

    expect(product.amountUnit).toBe('ml');
    expect(product.micronutrients).toEqual({ calciumMg: 10, potassiumMg: 170 });
    expect(product.sourceImageUrl).toContain('images.openfoodfacts.org');
  });

  it('never surfaces a stored photo URL from an untrusted host', () => {
    const product = rowToRecord(
      '8934563138162',
      cachedRow({
        imageUrl: 'http://169.254.169.254/latest/meta-data',
      }) as never
    );

    expect(product.sourceImageUrl).toBeNull();
  });
});

describe('row versioning', () => {
  it('treats a row with no version as stale, and the current one as fresh', () => {
    expect(isStaleBarcodeRow(cachedRow() as never)).toBe(true);
    expect(
      isStaleBarcodeRow(
        cachedRow({ barcodeDataVersion: BARCODE_DATA_VERSION }) as never
      )
    ).toBe(false);
  });

  it('reads the provider off the id prefix', () => {
    expect(providerIdOfRow(cachedRow() as never)).toBe('off');
    expect(
      providerIdOfRow(cachedRow({ id: 'fdc_049000050103' }) as never)
    ).toBe('usda_fdc');
  });
});

describe('getBarcodeSourceIds', () => {
  it('resolves every source code in one query, keyed by code', async () => {
    const { limit } = mockSelect([
      { id: 42, code: 'OFF' },
      { id: 77, code: 'USDA_FDC' },
    ]);

    const ids = await getBarcodeSourceIds();

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(2);
    expect(ids.get('OFF')).toBe(42);
    expect(ids.get('USDA_FDC')).toBe(77);
  });

  it('omits codes with no seeded row', async () => {
    mockSelect([{ id: 42, code: 'OFF' }]);

    const ids = await getBarcodeSourceIds();
    expect(ids.get('USDA_FDC')).toBeUndefined();
  });
});

describe('cacheBarcodeProduct', () => {
  const product: BarcodeProductRecord = {
    barcode: '049000050103',
    name: 'Coca-Cola Original',
    brand: 'Coca-Cola',
    caloriesKcal: 42,
    proteinG: 0,
    carbohydrateG: 10.6,
    fatG: 0,
    fiberG: null,
    sodiumMg: 4,
    servingSizeG: 240,
    packageSizeG: null,
    amountUnit: 'ml',
    micronutrients: { potassiumMg: 2 },
    sourceImageUrl: null,
  };

  it('upserts under the resolving provider prefix with the current version', async () => {
    const captured: unknown[] = [];
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        captured.push(val);
        return { onConflictDoUpdate };
      }),
    });

    await cacheBarcodeProduct({
      providerId: 'usda_fdc',
      barcode: '049000050103',
      product,
      sourceId: 77,
    });

    expect(captured[0]).toMatchObject({
      id: 'fdc_049000050103',
      namePrimary: '[Coca-Cola] Coca-Cola Original',
      nameEn: 'Coca-Cola Original',
      typeVn: 'Sản phẩm đóng gói',
      state: 'cooked',
      sourceId: 77,
      caloriesKcal: '42',
      fiberG: null,
      servingSizeG: '240',
      packageSizeG: null,
      amountUnit: 'ml',
      imageUrl: null,
      barcodeDataVersion: BARCODE_DATA_VERSION,
      potassiumMg: '2',
      // A first insert writes every column, absent ones as null.
      calciumMg: null,
    });

    const { target, set } = onConflictDoUpdate.mock.calls[0][0];
    expect(target).toBe(vietnameseFoodComposition.id);
    // A refresh fills and corrects but never erases: each provider column is
    // the fresh value, or the stored one when the provider now omits it.
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(set.calciumMg).sql).toBe(
      'coalesce(excluded."calcium_mg", "vietnamese_food_composition"."calcium_mg")'
    );
    expect(dialect.sqlToQuery(set.vitaminB12Mcg).sql).toBe(
      'coalesce(excluded."vitamin_b12_mcg", "vietnamese_food_composition"."vitamin_b12_mcg")'
    );
    // The one erasure: a macro the zero-fill may have written as 0 is cleared
    // when the refresh leaves it blank, so a v2 row's unproven 0 cannot
    // survive under a v3 stamp. Any other stored macro value is kept.
    expect(dialect.sqlToQuery(set.fatG).sql).toBe(
      'case when excluded."fat_g" is null and "vietnamese_food_composition"."fat_g" = 0 then null else coalesce(excluded."fat_g", "vietnamese_food_composition"."fat_g") end'
    );
    for (const macro of ['proteinG', 'carbohydrateG'] as const) {
      expect(dialect.sqlToQuery(set[macro]).sql).toMatch(/^case when /);
    }
    expect(dialect.sqlToQuery(set.caloriesKcal).sql).toMatch(/^coalesce\(/);
    expect(Object.keys(set)).toEqual(
      expect.arrayContaining([
        'amountUnit',
        'imageUrl',
        'barcodeDataVersion',
        'caloriesKcal',
        'servingSizeG',
      ])
    );
    expect(set).not.toHaveProperty('namePrimary');
  });

  it('stores an unbranded name unchanged', async () => {
    const captured: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        captured.push(val);
        return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
      }),
    });

    await cacheBarcodeProduct({
      providerId: 'off',
      barcode: '8934563138162',
      product: { ...product, brand: null, name: 'Hảo Hảo' },
      sourceId: 42,
    });

    expect(captured[0]).toMatchObject({
      id: 'off_8934563138162',
      namePrimary: 'Hảo Hảo',
    });
    // The search columns are trigger-owned; the insert must not supply them.
    expect(captured[0]).not.toHaveProperty('searchText');
    expect(captured[0]).not.toHaveProperty('searchTextAscii');
  });
});
