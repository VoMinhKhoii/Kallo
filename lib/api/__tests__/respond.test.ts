import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/respond';

describe('handleRouteError', () => {
  it('serializes schema failures as a structured 400 response', async () => {
    const error = z
      .object({ id: z.string().uuid('UUID không hợp lệ.') })
      .safeParse({
        id: 'not-a-uuid',
      }).error;

    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        status: 400,
        retryable: false,
        message: 'UUID không hợp lệ.',
        resolution:
          'Correct the request using the published schema, then retry.',
      },
    });
  });
});
