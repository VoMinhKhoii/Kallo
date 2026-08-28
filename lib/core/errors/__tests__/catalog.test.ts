import { describe, expect, it } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

// ---------------------------------------------------------------------------
// Errors factories
// ---------------------------------------------------------------------------

describe('Errors factories', () => {
  it('notAuthenticated is 401 non-retryable', () => {
    const err = Errors.notAuthenticated();
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
  });

  it('profileNotFound is 404', () => {
    const err = Errors.profileNotFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe('PROFILE_NOT_FOUND');
  });

  it('pipelineTimeout is 504 retryable', () => {
    const err = Errors.pipelineTimeout();
    expect(err.status).toBe(504);
    expect(err.retryable).toBe(true);
  });

  it('validationFailed accepts detail', () => {
    const err = Errors.validationFailed('Bad input');
    expect(err.status).toBe(400);
    expect(err.userMessage).toBe('Bad input');
  });

  it('rateLimited is 429 retryable', () => {
    const err = Errors.rateLimited();
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });

  it('circleLimitReached is a non-retryable 409 carrying the detail', () => {
    const err = Errors.circleLimitReached('Mai đã đạt giới hạn 2 nhóm.');
    expect(err.code).toBe('CIRCLE_LIMIT_REACHED');
    expect(err.status).toBe(409);
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toBe('Mai đã đạt giới hạn 2 nhóm.');
  });

  it('internal stores cause', () => {
    const cause = new TypeError('oops');
    const err = Errors.internal(cause);
    expect(err.status).toBe(500);
    expect(err.cause).toBe(cause);
  });
});
