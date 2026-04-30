import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted spies — must be declared before vi.mock factories run
// ---------------------------------------------------------------------------
const {
  insertedTables,
  insertValuesSpy,
  updateSpy,
  selectSpy,
  analyzeMealSpy,
} = vi.hoisted(() => {
  const insertedTables: unknown[] = [];
  const insertValuesSpy = vi.fn().mockReturnValue({ catch: vi.fn() });
  const updateSpy = vi.fn().mockResolvedValue([]);
  const selectSpy = vi.fn();
  const analyzeMealSpy = vi.fn(async () => ({}));
  return {
    insertedTables,
    insertValuesSpy,
    updateSpy,
    selectSpy,
    analyzeMealSpy,
  };
});

// ---------------------------------------------------------------------------
// DB mock — track which tables are passed to db.insert()
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn((table: unknown) => {
      insertedTables.push(table);
      return { values: insertValuesSpy };
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: selectSpy }) }) }),
    update: () => ({ set: () => ({ where: updateSpy }) }),
  },
}));

// ---------------------------------------------------------------------------
// Other mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/ai/pipeline/orchestrator', () => ({
  analyzeMeal: analyzeMealSpy,
}));
vi.mock('@/lib/ai/gemini', () => ({ createGeminiClient: () => ({}) }));
vi.mock('@/lib/admin/require-admin', () => ({
  requireAdmin: async () => ({ id: 'admin-1', email: 'a@x.com' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { pendingAnalyses } from '@/lib/db/schema';
import { replayRequest } from '../[id]/actions';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('replayRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedTables.length = 0;
    insertValuesSpy.mockReturnValue({ catch: vi.fn() });
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('does not write to pendingAnalyses', async () => {
    selectSpy.mockResolvedValue([
      { rawInput: 'x', userContextJson: {}, userId: 'orig-user' },
    ]);
    await replayRequest('11111111-1111-4111-a111-111111111111');
    expect(insertedTables).not.toContain(pendingAnalyses);
    expect(analyzeMealSpy).toHaveBeenCalled();
  });

  it('rejects non-uuid input', async () => {
    await expect(replayRequest('not-a-uuid')).rejects.toThrow();
  });

  it('reuses original user_id, not admin id', async () => {
    selectSpy.mockResolvedValue([
      { rawInput: 'x', userContextJson: {}, userId: 'orig-user' },
    ]);
    await replayRequest('11111111-1111-4111-a111-111111111111');
    const insertArgs = insertValuesSpy.mock.calls[0]?.[0];
    expect(insertArgs?.userId).toBe('orig-user');
  });
});
