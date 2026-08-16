import { describe, expect, it } from 'vitest';
import { Errors } from '@/lib/errors/catalog';

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

  it('internal stores cause', () => {
    const cause = new TypeError('oops');
    const err = Errors.internal(cause);
    expect(err.status).toBe(500);
    expect(err.cause).toBe(cause);
  });
});
