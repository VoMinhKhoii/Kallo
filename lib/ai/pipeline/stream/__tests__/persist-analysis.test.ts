import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const written: unknown[] = [];
const insert = vi.fn(() => ({
  values: (row: unknown) => ({
    onConflictDoUpdate: () => ({
      returning: async () => {
        written.push(row);
        return [{ id: 'analysis-1' }];
      },
    }),
  }),
}));
vi.mock('@/lib/infra/db/client', () => ({ db: { insert } }));

const { PERSIST_DEADLINE_MS, stampAndStage } = await import(
  '@/lib/ai/pipeline/stream/persist-analysis'
);

const values = {
  userId: 'u1',
  pipelineResult: {},
  rawInput: 'a medium banana',
  entryMode: 'precise' as const,
};
const STAMP_AT = new Date('2026-11-10T09:06:00.000Z');
const STAMP = { loggedAt: STAMP_AT, isBackfilled: true };

describe('stampAndStage', () => {
  beforeEach(() => {
    insert.mockClear();
    written.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('stages the row with the stamp and returns both', async () => {
    const result = await stampAndStage(
      {
        resolveLoggedAt: async () => STAMP,
        signal: new AbortController().signal,
      },
      values
    );

    expect(result).toEqual({ analysisId: 'analysis-1', loggedAt: STAMP_AT });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(written[0]).toMatchObject({
      loggedAt: STAMP_AT,
      isBackfilled: true,
    });
  });

  it('writes nothing when the client left while the day was read', async () => {
    const controller = new AbortController();

    const staged = await stampAndStage(
      {
        resolveLoggedAt: async () => {
          controller.abort();
          return STAMP;
        },
        signal: controller.signal,
      },
      values
    );

    expect(staged).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('shares one deadline: a stamp that used it all writes nothing', async () => {
    vi.useFakeTimers();
    const start = Date.now();

    const staged = stampAndStage(
      {
        // Resolves just inside its own deadline, leaving no budget to insert.
        resolveLoggedAt: async () => {
          vi.setSystemTime(start + PERSIST_DEADLINE_MS);
          return STAMP;
        },
        signal: new AbortController().signal,
      },
      values
    );

    await expect(staged).rejects.toMatchObject({ code: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });
});
