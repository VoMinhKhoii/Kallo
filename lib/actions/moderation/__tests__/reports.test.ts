import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `after()` needs a request scope; the double collects the task so a case can
// run it — and prove the request already resolved before the email went out.
const { afterTasks, mockResolveTarget, mockSendEmail } = vi.hoisted(() => ({
  afterTasks: [] as Array<() => unknown>,
  mockResolveTarget: vi.fn(),
  mockSendEmail: vi.fn(),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: (task: () => unknown) => {
    afterTasks.push(task);
  },
}));
vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/domain/social/moderation/report-targets', () => ({
  resolveReportTarget: mockResolveTarget,
}));
vi.mock('@/lib/infra/email/send', () => ({ sendEmail: mockSendEmail }));

import { createContentReport } from '@/lib/actions/moderation/reports';

const REPORTER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const TARGET = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const REPORT_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const CREATED_AT = new Date('2026-09-25T12:00:00.000Z');

const validInput = {
  targetKind: 'reply' as const,
  targetId: TARGET,
  reason: 'harassment' as const,
  note: 'keeps insulting me',
};

/** insert().values().onConflictDoNothing().returning() → `inserted`; the
 * duplicate path's select().from().where().limit() → `existing`. */
function fakeDb(inserted: unknown[], existing: unknown[] = []) {
  const captured: { values?: Record<string, unknown> } = {};
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        captured.values = values;
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue(inserted),
          })),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(existing),
        })),
      })),
    })),
  };
  return { db, captured };
}

async function runAfterTasks() {
  for (const task of afterTasks.splice(0)) await task();
}

describe('createContentReport', () => {
  const originalAdmins = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    afterTasks.length = 0;
    process.env.ADMIN_EMAILS = 'mod@kallo.fit, Ops@Kallo.fit';
    mockResolveTarget.mockResolvedValue({ ownerId: OWNER, excerpt: 'mean' });
    mockSendEmail.mockResolvedValue({ id: 'email-1', skipped: false });
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalAdmins;
  });

  it('stores the report against the server-derived owner and alerts every admin', async () => {
    const { db, captured } = fakeDb([{ id: REPORT_ID, createdAt: CREATED_AT }]);

    await expect(
      createContentReport(
        REPORTER,
        // An older client still sending targetUserId: the key is not in the
        // contract, Zod strips it, and the owner comes from the target.
        { ...validInput, targetUserId: REPORTER } as never,
        db as never
      )
    ).resolves.toEqual({ id: REPORT_ID });

    expect(mockResolveTarget).toHaveBeenCalledWith(
      REPORTER,
      'reply',
      TARGET,
      db
    );
    expect(captured.values).toEqual({
      reporterId: REPORTER,
      targetUserId: OWNER,
      targetKind: 'reply',
      targetId: TARGET,
      reason: 'harassment',
      note: 'keeps insulting me',
    });
    // Nothing is sent inside the request; the alert is scheduled after it.
    expect(mockSendEmail).not.toHaveBeenCalled();
    await runAfterTasks();
    expect(mockSendEmail.mock.calls.map(([arg]) => arg.to).sort()).toEqual([
      'mod@kallo.fit',
      'ops@kallo.fit',
    ]);
    const message = mockSendEmail.mock.calls[0][0].message;
    expect(message.subject).toBe('[Kallo report] harassment · reply');
    expect(message.text).toContain('keeps insulting me');
    expect(message.text).toContain('mean');
  });

  it('never fails the request when the admin email fails', async () => {
    const { db } = fakeDb([{ id: REPORT_ID, createdAt: CREATED_AT }]);
    mockSendEmail.mockRejectedValue(new Error('resend down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      createContentReport(REPORTER, validInput, db as never)
    ).resolves.toEqual({ id: REPORT_ID });
    await expect(runAfterTasks()).resolves.toBeUndefined();

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('stores the report and skips mail when ADMIN_EMAILS is empty', async () => {
    process.env.ADMIN_EMAILS = '';
    const { db } = fakeDb([{ id: REPORT_ID, createdAt: CREATED_AT }]);
    const consoleWarn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await createContentReport(REPORTER, validInput, db as never);
    await runAfterTasks();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('returns the existing id for a repeat report and sends no second alert', async () => {
    const { db } = fakeDb([], [{ id: REPORT_ID }]);

    await expect(
      createContentReport(REPORTER, validInput, db as never)
    ).resolves.toEqual({ id: REPORT_ID });
    expect(afterTasks).toHaveLength(0);
  });

  it('404s a target that is missing or not visible to the reporter', async () => {
    mockResolveTarget.mockResolvedValueOnce(null);
    const { db } = fakeDb([]);

    await expect(
      createContentReport(REPORTER, validInput, db as never)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a report of your own content', async () => {
    mockResolveTarget.mockResolvedValueOnce({
      ownerId: REPORTER,
      excerpt: null,
    });
    const { db } = fakeDb([]);

    await expect(
      createContentReport(REPORTER, validInput, db as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validInput, targetKind: 'meal' }],
    [{ ...validInput, reason: 'annoying' }],
    [{ ...validInput, targetId: 'not-a-uuid' }],
    [{ ...validInput, note: 'x'.repeat(501) }],
  ])('rejects an invalid body before resolving the target: %j', async (input) => {
    const { db } = fakeDb([]);

    await expect(
      createContentReport(REPORTER, input as never, db as never)
    ).rejects.toThrow();
    expect(mockResolveTarget).not.toHaveBeenCalled();
  });
});
