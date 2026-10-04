import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUser,
  mockGetUser,
  mockTxExecute,
  mockTxSelect,
  mockTxInsert,
  mockTx,
} = vi.hoisted(() => {
  const mockTxExecute = vi.fn();
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  return {
    mockUser: { id: 'user-123', email: 'test@example.com' },
    mockGetUser: vi.fn(),
    mockTxExecute,
    mockTxSelect,
    mockTxInsert,
    mockTx: {
      execute: mockTxExecute,
      select: mockTxSelect,
      insert: mockTxInsert,
    },
  };
});

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

const { putObject, listObjects } = vi.hoisted(() => ({
  putObject: vi.fn(),
  listObjects: vi.fn(),
}));

vi.mock('@/lib/infra/storage/object-storage', () => ({
  putObject,
  listObjects,
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock('@/lib/infra/db/schema', () => ({
  userFeedback: {
    id: 'userFeedback.id',
    userId: 'userFeedback.userId',
    createdAt: 'userFeedback.createdAt',
  },
}));

import {
  submitFeedbackAction,
  uploadFeedbackScreenshotAction,
} from '@/lib/actions/support/feedback';

function stubHourlyCount(count: number) {
  mockTxSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  });
}

function stubInsertReturning(id: string) {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id }]),
  });
  mockTxInsert.mockReturnValue({ values });
  return values;
}

describe('submitFeedbackAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockTxExecute.mockResolvedValue(undefined);
  });

  it('inserts with the session user id (never client input) and returns the new id', async () => {
    stubHourlyCount(0);
    const values = stubInsertReturning('fb-1');

    const result = await submitFeedbackAction({
      type: 'bug',
      message: 'The camera crashes on scan.',
      platform: 'ios',
      locale: 'vi',
    });

    expect(result).toEqual({ id: 'fb-1' });
    // The count-then-insert runs behind a per-user advisory lock.
    expect(mockTxExecute).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: 'bug',
        message: 'The camera crashes on scan.',
        platform: 'ios',
        locale: 'vi',
      })
    );
  });

  it('rate-limits after 10 submissions in the last hour', async () => {
    stubHourlyCount(10);
    stubInsertReturning('should-not-be-used');

    await expect(
      submitFeedbackAction({ type: 'idea', message: 'another one' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects a screenshotPath that is not owned by the session user', async () => {
    stubHourlyCount(0);
    stubInsertReturning('fb-2');

    await expect(
      submitFeedbackAction({
        type: 'bug',
        message: 'x',
        // valid format, but the owner segment is someone else's id
        screenshotPath:
          '00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.png',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      submitFeedbackAction({ type: 'bug', message: 'x' })
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED', status: 401 });
    expect(mockTxSelect).not.toHaveBeenCalled();
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

function pngFile(bytes: Uint8Array = PNG, type = 'image/png', name = 'a.png') {
  return new File([bytes as BlobPart], name, { type });
}

describe('uploadFeedbackScreenshotAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    putObject.mockResolvedValue(undefined);
    listObjects.mockResolvedValue([]);
  });

  it('stores the bytes under the session user prefix, ignoring the filename', async () => {
    const result = await uploadFeedbackScreenshotAction(
      pngFile(PNG, 'image/png', '../someone-else/x.png')
    );

    expect(result.path).toMatch(/^user-123\/[0-9a-f-]{36}\.png$/i);
    expect(listObjects).toHaveBeenCalledWith(
      'feedback-screenshots',
      'user-123/'
    );
    expect(putObject).toHaveBeenCalledWith(
      'feedback-screenshots',
      result.path,
      PNG,
      { contentType: 'image/png' }
    );
  });

  it('never stores bytes whose content does not match the type', async () => {
    const jpegClaim = pngFile(PNG, 'image/jpeg');

    await expect(
      uploadFeedbackScreenshotAction(jpegClaim)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(putObject).not.toHaveBeenCalled();
  });

  it('rate-limits after 20 uploads in the last hour', async () => {
    const recent = new Date(Date.now() - 60_000);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    listObjects.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) => ({
        key: `user-123/${i}.png`,
        lastModified: recent,
      })),
      { key: 'user-123/old.png', lastModified: old },
    ]);

    await expect(
      uploadFeedbackScreenshotAction(pngFile())
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(putObject).not.toHaveBeenCalled();
  });

  it('allows the upload when the quota listing fails (the submit cap is the hard one)', async () => {
    listObjects.mockRejectedValue(new Error('r2 down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await uploadFeedbackScreenshotAction(pngFile());

    expect(putObject).toHaveBeenCalled();
    log.mockRestore();
  });

  it('maps a storage failure to an internal error', async () => {
    putObject.mockRejectedValue(new Error('r2 down'));

    await expect(
      uploadFeedbackScreenshotAction(pngFile())
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('rejects when not authenticated, before touching storage', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      uploadFeedbackScreenshotAction(pngFile())
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(listObjects).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });
});
