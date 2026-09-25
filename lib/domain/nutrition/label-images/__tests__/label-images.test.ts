import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createAdminClient: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  selectWhere: vi.fn(),
  selectRows: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/ai/pipeline/estimator/label-ocr/label-ocr', () => ({
  NUTRITION_LABEL_OCR_MODEL: 'test-ocr-model',
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    insert: () => ({ values: mocks.insertValues }),
    update: () => ({
      set: (values: unknown) => {
        mocks.updateSet(values);
        return { where: mocks.updateWhere };
      },
    }),
    select: () => ({
      from: () => ({
        where: (where: SQL) => {
          mocks.selectWhere(where);
          return { limit: mocks.selectRows };
        },
      }),
    }),
  },
}));

const { NutritionLabelOcrError } = await import(
  '@/lib/ai/pipeline/estimator/label-ocr/normalization'
);
const { createLabelImageUrl, linkLabelImageToMeal, scanWithStoredLabelImage } =
  await import('@/lib/domain/nutrition/label-images/label-images');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const IMAGE = '33333333-3333-4333-8333-333333333333';
const MEAL = '44444444-4444-4444-8444-444444444444';
const UUID_RE = /^[0-9a-f-]{36}$/;

const input = {
  userId: USER,
  imageBase64: Buffer.from('jpeg-bytes').toString('base64'),
  mimeType: 'image/jpeg' as const,
};
const label = { productName: 'Bánh quy', confidence: 'high' } as never;

/** A model call that answers on a later turn of the event loop, as the real
 *  one (seconds, not microseconds) always does. */
async function scanned() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return label;
}

/** Resolve everything handed to `after()` — the post-response writes. */
async function settleAfter() {
  await Promise.all(mocks.after.mock.calls.map(([pending]) => pending));
}

function compile(where: SQL) {
  return new PgDialect().sqlToQuery(where);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createAdminClient.mockReturnValue({
    storage: { from: mocks.storageFrom },
  });
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    createSignedUrl: mocks.createSignedUrl,
  });
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.updateWhere.mockResolvedValue(undefined);
});

describe('scanWithStoredLabelImage — success', () => {
  it('uploads the photo, returns its id and records the result after the reply', async () => {
    const { result, labelImageId } = await scanWithStoredLabelImage(
      input,
      scanned
    );

    expect(result).toBe(label);
    expect(labelImageId).toMatch(UUID_RE);
    expect(mocks.storageFrom).toHaveBeenCalledWith('nutrition-labels');
    expect(mocks.upload).toHaveBeenCalledWith(
      `${USER}/${labelImageId}.jpg`,
      expect.any(Buffer),
      { contentType: 'image/jpeg', upsert: false }
    );

    await settleAfter();
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: labelImageId,
      userId: USER,
      storagePath: `${USER}/${labelImageId}.jpg`,
      mimeType: 'image/jpeg',
      byteSize: 'jpeg-bytes'.length,
      status: 'succeeded',
      result: label,
      errorCode: null,
      model: 'test-ocr-model',
      latencyMs: expect.any(Number),
    });
  });

  it('dispatches the model call first and uploads while it runs', async () => {
    const seen: string[] = [];
    mocks.upload.mockImplementation(async () => {
      seen.push('upload');
      return { data: {}, error: null };
    });
    const scan = vi.fn(async () => {
      seen.push('model call');
      await new Promise((resolve) => setTimeout(resolve, 0));
      seen.push('model answered');
      return label;
    });

    await scanWithStoredLabelImage(input, scan);
    expect(seen).toEqual(['model call', 'upload', 'model answered']);
  });

  it('never waits for a slow upload: no id in the reply, row still written', async () => {
    let finishUpload: (value: unknown) => void = () => {};
    mocks.upload.mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      })
    );

    const { result, labelImageId } = await scanWithStoredLabelImage(
      input,
      scanned
    );
    expect(result).toBe(label);
    expect(labelImageId).toBeNull();
    expect(mocks.insertValues).not.toHaveBeenCalled();

    finishUpload({ data: {}, error: null });
    await settleAfter();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', result: label })
    );
  });
});

describe('scanWithStoredLabelImage — failed scan', () => {
  const zodError = z.object({ a: z.string() }).safeParse({}).error;

  it.each([
    [
      'no label printed',
      new NutritionLabelOcrError('no_label_detected'),
      'no_label_detected',
    ],
    [
      'provider quota',
      Object.assign(new Error('quota'), { status: 429 }),
      'rate_limited',
    ],
    [
      'deadline',
      new DOMException('Nutrition label OCR timed out', 'AbortError'),
      'timeout',
    ],
    ['malformed model reply', zodError, 'invalid_model_output'],
    [
      'provider fault',
      new Error('Gemini returned empty response'),
      'server_error',
    ],
  ])('%s: rethrows the same error and records it as failed', async (_name, error, code) => {
    await expect(
      scanWithStoredLabelImage(input, async () => {
        throw error;
      })
    ).rejects.toBe(error);

    await settleAfter();
    const [row] = mocks.insertValues.mock.calls[0] ?? [];
    expect(row).toMatchObject({
      userId: USER,
      status: 'failed',
      result: null,
      errorCode: code,
      model: 'test-ocr-model',
    });
    expect(row.storagePath).toBe(`${USER}/${row.id}.jpg`);
  });
});

describe('scanWithStoredLabelImage — storage is best-effort', () => {
  it('a refused upload leaves the result untouched and writes no row', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error('down') });

    const outcome = await scanWithStoredLabelImage(input, scanned);
    expect(outcome).toEqual({ result: label, labelImageId: null });
    await settleAfter();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it('a missing service-role credential does not surface', async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error('service_role_missing');
    });

    const outcome = await scanWithStoredLabelImage(input, scanned);
    expect(outcome).toEqual({ result: label, labelImageId: null });
  });

  it('a failed row insert is swallowed', async () => {
    mocks.insertValues.mockRejectedValue(new Error('db down'));

    const outcome = await scanWithStoredLabelImage(input, scanned);
    expect(outcome.result).toBe(label);
    await expect(settleAfter()).resolves.toBeUndefined();
  });

  it('a storage failure does not change the scan error either', async () => {
    mocks.upload.mockRejectedValue(new Error('network'));
    const error = new NutritionLabelOcrError('no_label_detected');

    await expect(
      scanWithStoredLabelImage(input, async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });
});

describe('linkLabelImageToMeal', () => {
  const reviewed = {
    productName: 'Bánh quy',
    amount: 30,
    unit: 'g' as const,
    confidence: 'high' as const,
    calories: 150,
    proteinGrams: 2,
    carbsGrams: 20,
    fatGrams: 7,
    mealId: MEAL,
    labelImageId: IMAGE,
    loggedDate: '2026-09-25',
    timezoneOffset: -420,
  };

  it('sets the meal and the saved values, scoped to the caller', async () => {
    await linkLabelImageToMeal(USER, IMAGE, MEAL, reviewed);

    const { labelImageId: _i, mealId: _m, ...saved } = reviewed;
    expect(mocks.updateSet).toHaveBeenCalledWith({
      mealId: MEAL,
      reviewedResult: saved,
    });
    const { sql, params } = compile(mocks.updateWhere.mock.calls[0][0]);
    expect(sql).toBe(
      '("nutrition_label_images"."id" = $1 and "nutrition_label_images"."user_id" = $2)'
    );
    expect(params).toEqual([IMAGE, USER]);
  });

  it('swallows a failed update: the meal is already saved', async () => {
    mocks.updateWhere.mockRejectedValue(new Error('db down'));
    await expect(
      linkLabelImageToMeal(USER, IMAGE, MEAL, reviewed)
    ).resolves.toBeUndefined();
  });
});

describe('createLabelImageUrl', () => {
  it("404s an image that is not the caller's, without signing anything", async () => {
    mocks.selectRows.mockResolvedValue([]);

    await expect(createLabelImageUrl(OTHER, IMAGE)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    const { params } = compile(mocks.selectWhere.mock.calls[0][0]);
    expect(params).toEqual([IMAGE, OTHER]);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('signs a 10-minute URL for the owner', async () => {
    mocks.selectRows.mockResolvedValue([
      { storagePath: `${USER}/${IMAGE}.jpg` },
    ]);
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed' },
      error: null,
    });
    const before = Date.now();

    const view = await createLabelImageUrl(USER, IMAGE);

    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      `${USER}/${IMAGE}.jpg`,
      600
    );
    expect(view.url).toBe('https://storage.example/signed');
    const expiresIn = Date.parse(view.expiresAt) - before;
    expect(expiresIn).toBeGreaterThanOrEqual(600_000 - 1000);
    expect(expiresIn).toBeLessThanOrEqual(600_000 + 1000);
  });

  it('a signing failure is a 500, not a URL', async () => {
    mocks.selectRows.mockResolvedValue([
      { storagePath: `${USER}/${IMAGE}.jpg` },
    ]);
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('storage down'),
    });

    await expect(createLabelImageUrl(USER, IMAGE)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});
