import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';

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

describe('handleRouteError safety net', () => {
  // A route that parses with a bare `request.json()` throws SyntaxError. That
  // used to fall through to a retryable 500 INTERNAL (KALLO-08), telling the
  // client to resend the very bytes the server could not read.
  it('maps a JSON SyntaxError to a non-retryable 400', async () => {
    let thrown: unknown;
    try {
      JSON.parse('{"broken');
    } catch (error) {
      thrown = error;
    }

    const response = handleRouteError(thrown);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        status: 400,
        retryable: false,
        message: 'Invalid JSON in request body',
      },
    });
  });

  it('keeps unknown errors a generic 500', async () => {
    const response = handleRouteError(new Error('db down'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL', retryable: true },
    });
  });

  it('passes a conflict through as a non-retryable 409', async () => {
    const response = handleRouteError(Errors.conflict('taken'));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CONFLICT', retryable: false },
    });
  });
});
