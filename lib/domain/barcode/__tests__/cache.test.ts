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

vi.mock('@/lib/infra/db/schema', () => ({
  vietnameseFoodComposition: { id: 'vietnameseFoodComposition.id' },
  ingredientSources: {
    id: 'ingredientSources.id',
    code: 'ingredientSources.code',
  },
}));

import {
  barcodeCacheId,
  cacheBarcodeProduct,
  findCachedRow,
  getBarcodeSourceIds,
  rowToProduct,
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

describe('rowToProduct', () => {
  it('round-trips a bracketed brand out of the primary name', () => {
    const product = rowToProduct('8934563138162', cachedRow() as never);

    expect(product.brand).toBe('Acecook');
    expect(product.name).toBe('Hảo Hảo');
  });

  it('leaves the brand null for a bracket-less name', () => {
    const product = rowToProduct(
      '8934563138162',
      cachedRow({ namePrimary: 'Hảo Hảo' }) as never
    );

    expect(product.brand).toBeNull();
    expect(product.name).toBe('Hảo Hảo');
  });

  it('applies the 100kg cap and positivity rule on read', () => {
    const product = rowToProduct(
      '8934563138162',
      cachedRow({ servingSizeG: '500000', packageSizeG: '0' }) as never
    );

    expect(product.servingSizeG).toBeNull();
    expect(product.packageSizeG).toBeNull();
  });

  it('preserves nulls and coerces numeric strings', () => {
    const product = rowToProduct(
      '8934563138162',
      cachedRow({ fiberG: null, servingSizeG: '75' }) as never
    );

    expect(product.fiberG).toBeNull();
    expect(product.servingSizeG).toBe(75);
    expect(product.caloriesKcal).toBe(350);
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
  const product = {
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
  };

  it('inserts under the resolving provider prefix and skips races', async () => {
    const captured: unknown[] = [];
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        captured.push(val);
        return { onConflictDoNothing };
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
    });
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: 'vietnameseFoodComposition.id',
    });
  });

  it('stores an unbranded name unchanged', async () => {
    const captured: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        captured.push(val);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
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
