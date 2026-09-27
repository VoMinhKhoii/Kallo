import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import sharp from 'sharp';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createAdminClient: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
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
const { NUTRITION_LABEL_BUCKET } = await import(
  '@/lib/domain/nutrition/label-images/bucket'
);

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const IMAGE = '33333333-3333-4333-8333-333333333333';
const MEAL = '44444444-4444-4444-8444-444444444444';
const UUID_RE = /^[0-9a-f-]{36}$/;
/** The EXIF tag that points at the GPS sub-IFD, in either byte order. */
const GPS_POINTER = [Buffer.from([0x88, 0x25]), Buffer.from([0x25, 0x88])];

const label = { productName: 'Bánh quy', confidence: 'high' } as never;
let input: {
  userId: string;
  imageBase64: string;
  mimeType: 'image/jpeg';
};

/** A 64x32 phone-style JPEG carrying a camera make, a GPS position and an
 *  EXIF orientation of 6 (displayed rotated 90°, i.e. 32x64). */
beforeAll(async () => {
  const jpeg = await sharp({
    create: {
      width: 64,
      height: 32,
      channels: 3,
      background: { r: 200, g: 150, b: 100 },
    },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: 'TestCam' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '10/1 45/1 0/1' },
      },
    })
    .toBuffer();
  input = {
    userId: USER,
    imageBase64: jpeg.toString('base64'),
    mimeType: 'image/jpeg',
  };
});

/** A model call that answers only once the photo is stored — the normal
 *  order, since a vision call takes seconds and a storage PUT milliseconds. */
async function answersAfterUpload() {
  await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return label;
}

/** Resolve everything handed to `after()` — the post-response writes. */
async function settleAfter() {
  await Promise.all(mocks.after.mock.calls.map(([pending]) => pending));
}

/** The bytes and options the bucket actually received. */
function uploaded() {
  const [path, bytes, options] = mocks.upload.mock.calls[0];
  return { path: path as string, bytes: bytes as Buffer, options };
}

function compile(where: SQL) {
  return new PgDialect().sqlToQuery(where);
}

// No test's post-response writes may land in the next test's mocks.
afterEach(settleAfter);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createAdminClient.mockReturnValue({
    storage: { from: mocks.storageFrom },
  });
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    remove: mocks.remove,
    createSignedUrl: mocks.createSignedUrl,
  });
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.updateWhere.mockResolvedValue(undefined);
});

describe('scanWithStoredLabelImage — success', () => {
  it('stores the photo, writes its row before replying and returns its id', async () => {
    const { result, labelImageId } = await scanWithStoredLabelImage(
      input,
      answersAfterUpload
    );

    expect(result).toBe(label);
    expect(labelImageId).toMatch(UUID_RE);
    expect(NUTRITION_LABEL_BUCKET).toBe('nutrition-labels');
    expect(mocks.storageFrom).toHaveBeenCalledWith('nutrition-labels');
    const { path, bytes, options } = uploaded();
    expect(path).toBe(`${USER}/${labelImageId}.jpg`);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });

    // The row already exists when the id is handed out: no after() needed.
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: labelImageId,
      userId: USER,
      storagePath: `${USER}/${labelImageId}.jpg`,
      mimeType: 'image/jpeg',
      byteSize: bytes.byteLength,
      status: 'succeeded',
      result: label,
      errorCode: null,
      model: 'test-ocr-model',
      latencyMs: expect.any(Number),
    });
  });

  it('stores the photo without its EXIF (GPS, camera), upright', async () => {
    const original = await sharp(Buffer.from(input.imageBase64, 'base64'))
      .metadata()
      .then((meta) => meta.exif ?? Buffer.alloc(0));
    expect(GPS_POINTER.some((tag) => original.includes(tag))).toBe(true);
    expect(original.toString('latin1')).toContain('TestCam');

    await scanWithStoredLabelImage(input, answersAfterUpload);

    const { bytes } = uploaded();
    const stored = await sharp(bytes).metadata();
    expect(stored.format).toBe('jpeg');
    expect(stored.exif).toBeUndefined();
    expect(stored.xmp).toBeUndefined();
    expect(stored.orientation).toBeUndefined();
    expect([stored.width, stored.height]).toEqual([32, 64]);
    expect(bytes.includes(Buffer.from('TestCam'))).toBe(false);
  });

  it('dispatches the model call before storing anything', async () => {
    const seen: string[] = [];
    mocks.upload.mockImplementation(async () => {
      seen.push('upload');
      return { data: {}, error: null };
    });
    const scan = vi.fn(async () => {
      seen.push('model call');
      return answersAfterUpload();
    });

    await scanWithStoredLabelImage(input, scan);
    expect(seen).toEqual(['model call', 'upload']);
  });

  it('never waits for a slow upload: no id in the reply, row written after it', async () => {
    let finishUpload: (value: unknown) => void = () => {};
    mocks.upload.mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      })
    );

    const { result, labelImageId } = await scanWithStoredLabelImage(
      input,
      answersAfterUpload
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

describe('scanWithStoredLabelImage — photo and row never diverge', () => {
  it('a failed inline insert removes the photo and returns no id', async () => {
    mocks.insertValues.mockRejectedValue(new Error('db down'));

    const outcome = await scanWithStoredLabelImage(input, answersAfterUpload);
    expect(outcome).toEqual({ result: label, labelImageId: null });
    expect(mocks.remove).toHaveBeenCalledWith([uploaded().path]);
  });

  it('a failed post-response insert (e.g. account deleted meanwhile) removes the photo', async () => {
    let finishUpload: (value: unknown) => void = () => {};
    mocks.upload.mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      })
    );
    mocks.insertValues.mockRejectedValue(
      new Error('violates foreign key constraint')
    );

    await scanWithStoredLabelImage(input, answersAfterUpload);
    finishUpload({ data: {}, error: null });
    await settleAfter();
    expect(mocks.remove).toHaveBeenCalledWith([uploaded().path]);
  });

  it('a failed removal is only logged', async () => {
    mocks.insertValues.mockRejectedValue(new Error('db down'));
    mocks.remove.mockResolvedValue({ data: null, error: new Error('down') });

    const outcome = await scanWithStoredLabelImage(input, answersAfterUpload);
    expect(outcome).toEqual({ result: label, labelImageId: null });
    expect(console.error).toHaveBeenCalledWith(
      '[label-images] Removing a label photo without a row failed:',
      uploaded().path,
      expect.any(Error)
    );
  });
});

describe('scanWithStoredLabelImage — storage is best-effort', () => {
  it('a refused upload leaves the result untouched and writes no row', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error('down') });

    const outcome = await scanWithStoredLabelImage(input, answersAfterUpload);
    expect(outcome).toEqual({ result: label, labelImageId: null });
    await settleAfter();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it('bytes that cannot be re-encoded are never stored as sent', async () => {
    const junk = {
      ...input,
      imageBase64: Buffer.from('not-a-jpeg').toString('base64'),
    };
    const outcome = await scanWithStoredLabelImage(junk, async () => label);
    await settleAfter();
    expect(outcome).toEqual({ result: label, labelImageId: null });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it('a missing service-role credential does not surface', async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error('service_role_missing');
    });

    const outcome = await scanWithStoredLabelImage(input, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return label;
    });
    expect(outcome).toEqual({ result: label, labelImageId: null });
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
    sodiumMg: 90,
    mealId: MEAL,
    labelImageId: IMAGE,
    loggedDate: '2026-09-25',
    timezoneOffset: -420,
  };

  it('stores only the reviewed correction, scoped to the caller', async () => {
    await linkLabelImageToMeal(USER, IMAGE, MEAL, reviewed);

    expect(mocks.updateSet).toHaveBeenCalledWith({
      mealId: MEAL,
      reviewedResult: {
        productName: 'Bánh quy',
        amount: 30,
        unit: 'g',
        calories: 150,
        proteinGrams: 2,
        carbsGrams: 20,
        fatGrams: 7,
        sodiumMg: 90,
      },
    });
  });

  it('links only an unlinked scan, so a replay cannot re-point it', async () => {
    await linkLabelImageToMeal(USER, IMAGE, MEAL, reviewed);

    const { sql, params } = compile(mocks.updateWhere.mock.calls[0][0]);
    expect(sql).toBe(
      '("nutrition_label_images"."id" = $1 and "nutrition_label_images"."user_id" = $2 and "nutrition_label_images"."meal_id" is null)'
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
