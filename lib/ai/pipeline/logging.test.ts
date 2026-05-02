import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';
import type { UserContext } from '../types';
import { logPipelineEnd, logPipelineStart } from './logging';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

interface MockInsertDb {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  asAppDb: AppDb;
}

function createMockInsertDb(): MockInsertDb {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const updateSet = vi.fn().mockResolvedValue(undefined);
  const where = vi.fn().mockReturnValue(updateSet);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  const asAppDb = { insert, update } as unknown as AppDb;
  return { insert, update, values, set, where, asAppDb };
}

const MOCK_USER_CONTEXT: UserContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  goal: 'maintaining',
  aggression: 0,
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'finish_it',
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// logPipelineStart
// ---------------------------------------------------------------------------

describe('logPipelineStart', () => {
  it('returns a UUID after awaiting DB write', async () => {
    const db = createMockInsertDb();
    const id = await logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db: db.asAppDb,
    });

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(db.insert).toHaveBeenCalled();
  });

  it('passes the pre-generated id into the INSERT values', async () => {
    const db = createMockInsertDb();
    const id = await logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db: db.asAppDb,
    });

    const valuesArg = db.values.mock.calls[0][0];
    expect(valuesArg.id).toBe(id);
    expect(valuesArg.userId).toBe('user-1');
    expect(valuesArg.rawInput).toBe('phở bò');
  });

  it('returns null on DB error — does not throw', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('DB write failed')),
      }),
    } as unknown as AppDb;

    const id = await logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db,
    });

    expect(id).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create request log'),
      expect.any(Error)
    );
  });
});

// ---------------------------------------------------------------------------
// logPipelineEnd
// ---------------------------------------------------------------------------

describe('logPipelineEnd', () => {
  it('is a no-op when requestId is null', () => {
    const db = createMockInsertDb();
    // Should not throw
    expect(() =>
      logPipelineEnd(null, 'success', 1200, db.asAppDb)
    ).not.toThrow();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('fire-and-forgets DB update — does not throw on error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('update failed')),
        }),
      }),
    } as unknown as AppDb;

    // Should not throw synchronously
    expect(() =>
      logPipelineEnd('req-123', 'error', 3000, db, 'rate_limit')
    ).not.toThrow();

    // Wait for the promise to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update request log'),
      expect.any(Error)
    );
  });

  it('unhandled rejection from fire-and-forget is caught internally', async () => {
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('catastrophic')),
        }),
      }),
    } as unknown as AppDb;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // logPipelineEnd returns void — the internal promise rejection must be caught
    logPipelineEnd('req-abc', 'success', 500, db);

    // Allow micro-task queue to drain
    await new Promise((r) => setTimeout(r, 20));

    // No unhandled rejection propagated — error was caught internally
    expect(errorSpy).toHaveBeenCalled();
  });
});
