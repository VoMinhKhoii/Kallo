import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReadJsonBody, mockAssertRateLimit, mockCreateReport } = vi.hoisted(
  () => ({
    mockReadJsonBody: vi.fn(),
    mockAssertRateLimit: vi.fn(),
    mockCreateReport: vi.fn(),
  })
);

const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const REPORT_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';

vi.mock('@/lib/api/auth', () => ({
  readJsonBody: mockReadJsonBody,
  requireUserId: vi
    .fn()
    .mockResolvedValue('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: mockAssertRateLimit,
}));
vi.mock('@/lib/actions/moderation/reports', () => ({
  createContentReport: mockCreateReport,
}));

import { POST } from '@/app/api/v1/reports/route';

describe('POST /api/v1/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertRateLimit.mockResolvedValue(undefined);
    mockCreateReport.mockResolvedValue({ id: REPORT_ID });
  });

  it('answers 201 with the report id for a valid body', async () => {
    mockReadJsonBody.mockResolvedValueOnce({
      targetKind: 'chat_message',
      targetId: TARGET.toUpperCase(),
      reason: 'spam',
      note: '  ',
    });

    const response = await POST({} as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: REPORT_ID });
    expect(mockAssertRateLimit).toHaveBeenCalledWith('contentReport', {
      kind: 'user',
      value: ACTOR,
    });
    // Parsed at the boundary: uuid lowercased, a blank note dropped.
    expect(mockCreateReport).toHaveBeenCalledWith(ACTOR, {
      targetKind: 'chat_message',
      targetId: TARGET,
      reason: 'spam',
    });
  });

  it.each([
    [{ targetKind: 'meal', targetId: TARGET, reason: 'spam' }],
    [{ targetKind: 'share', targetId: TARGET, reason: 'rude' }],
    [{ targetKind: 'share', targetId: 'nope', reason: 'spam' }],
    [{ targetKind: 'share', reason: 'spam' }],
    [
      {
        targetKind: 'share',
        targetId: TARGET,
        reason: 'other',
        note: 'x'.repeat(501),
      },
    ],
  ])('answers 400 for %j without calling the action', async (body) => {
    mockReadJsonBody.mockResolvedValueOnce(body);

    const response = await POST({} as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(mockCreateReport).not.toHaveBeenCalled();
  });

  it('charges the rate limit before reading the body', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    mockAssertRateLimit.mockRejectedValueOnce(
      Errors.rateLimited(undefined, 30)
    );

    const response = await POST({} as never);

    expect(response.status).toBe(429);
    expect(mockReadJsonBody).not.toHaveBeenCalled();
    expect(mockCreateReport).not.toHaveBeenCalled();
  });
});
