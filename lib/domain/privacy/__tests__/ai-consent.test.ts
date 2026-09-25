import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/core/errors/app-error';
import {
  type AiConsentSubject,
  assertAiConsent,
  hasAiConsent,
} from '@/lib/domain/privacy/ai-consent';

const consented = { aiProcessingConsentedAt: new Date('2026-09-25T12:00:00Z') };
const notConsented = { aiProcessingConsentedAt: null };

describe('hasAiConsent', () => {
  it('is true only for a recorded consent timestamp', () => {
    expect(hasAiConsent(consented)).toBe(true);
    expect(hasAiConsent(notConsented)).toBe(false);
  });

  it('fails closed when the field is missing from a partial row', () => {
    expect(hasAiConsent({} as AiConsentSubject)).toBe(false);
  });
});

describe('assertAiConsent', () => {
  it('passes silently for a consented user', () => {
    expect(() => assertAiConsent(consented)).not.toThrow();
  });

  it('throws a non-retryable 403 ai_consent_required otherwise', () => {
    let caught: unknown;
    try {
      assertAiConsent(notConsented);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    const error = caught as AppError;
    expect(error.code).toBe('ai_consent_required');
    expect(error.status).toBe(403);
    expect(error.retryable).toBe(false);
    expect(error.toJSON().error.resolution).toContain('permission');
  });
});
