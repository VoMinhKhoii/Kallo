import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logPipelineEnd, logPipelineStart } from './logging';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockInsertDb(): any {
  const catchFn = vi.fn().mockReturnValue(undefined);
  const values = vi.fn().mockReturnValue({ catch: catchFn });
  const insert = vi.fn().mockReturnValue({ values });
  const updateSet = vi.fn().mockResolvedValue(undefined);
  const where = vi.fn().mockReturnValue(updateSet);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  return { insert, update, values, set, where, catch: catchFn };
}

const MOCK_USER_CONTEXT: any = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  goal: 'maintain',
  aggression: 1,
  cookingHabits: '',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// logPipelineStart
// ---------------------------------------------------------------------------

describe('logPipelineStart', () => {
  it('returns a UUID synchronously without awaiting DB', () => {
    const db = createMockInsertDb();
    const id = logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db,
    });

    // Must be a valid UUID (synchronous, no await)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    // INSERT was fired
    expect(db.insert).toHaveBeenCalled();
  });

  it('passes the pre-generated id into the INSERT values', () => {
    const db = createMockInsertDb();
    const id = logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db,
    });

    const valuesArg = db.values.mock.calls[0][0];
    expect(valuesArg.id).toBe(id);
    expect(valuesArg.userId).toBe('user-1');
    expect(valuesArg.rawInput).toBe('phở bò');
  });

  it('does not throw on DB error — catches internally', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let catchHandler: ((err: Error) => void) | undefined;
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          catch: vi.fn().mockImplementation((fn: (err: Error) => void) => {
            catchHandler = fn;
          }),
        }),
      }),
    } as any;

    const id = logPipelineStart({
      userId: 'user-1',
      rawInput: 'phở bò',
      userContext: MOCK_USER_CONTEXT,
      db,
    });

    // Returns synchronously regardless
    expect(typeof id).toBe('string');

    // Simulate DB error via the catch handler
    catchHandler?.(new Error('DB write failed'));

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
    expect(() => logPipelineEnd(null, 'success', 1200, db)).not.toThrow();
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
    } as any;

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
    } as any;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // logPipelineEnd returns void — the internal promise rejection must be caught
    logPipelineEnd('req-abc', 'success', 500, db);

    // Allow micro-task queue to drain
    await new Promise((r) => setTimeout(r, 20));

    // No unhandled rejection propagated — error was caught internally
    expect(errorSpy).toHaveBeenCalled();
  });
});
