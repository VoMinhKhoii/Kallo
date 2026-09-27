import { describe, expect, it } from 'vitest';
import {
  classifyPreStreamRefusal,
  preStreamErrorMessage,
} from '@/lib/ai/streaming/pre-stream-refusal';

const consentBody = {
  error: {
    code: 'ai_consent_required',
    message: 'Allow Kallo to send your meal first.',
    retryable: false,
  },
};

describe('classifyPreStreamRefusal', () => {
  it('reads a plain 403 as an error, not a consent prompt', () => {
    // The origin lock, a WAF or Cloud Run: no body, a legacy string body, or
    // a structured body with some other code.
    expect(classifyPreStreamRefusal(403, null)).toBe('error');
    expect(classifyPreStreamRefusal(403, { error: 'Forbidden' })).toBe('error');
    expect(
      classifyPreStreamRefusal(403, {
        error: { code: 'NOT_AUTHENTICATED', message: 'Forbidden' },
      })
    ).toBe('error');
    expect(classifyPreStreamRefusal(403, '<html>denied</html>')).toBe('error');
  });

  it('asks for consent on a 403 carrying ai_consent_required', () => {
    expect(classifyPreStreamRefusal(403, consentBody)).toBe('consentRequired');
  });

  it('reads a 402 as paymentRequired, whatever the body says', () => {
    expect(
      classifyPreStreamRefusal(402, { error: { code: 'feature_locked' } })
    ).toBe('paymentRequired');
    expect(classifyPreStreamRefusal(402, null)).toBe('paymentRequired');
  });

  it('reads any other failure as an error', () => {
    expect(classifyPreStreamRefusal(429, { error: 'slow down' })).toBe('error');
    expect(classifyPreStreamRefusal(500, null)).toBe('error');
  });
});

describe('preStreamErrorMessage', () => {
  it('takes the message from either envelope, else names the status', () => {
    expect(preStreamErrorMessage(403, consentBody)).toBe(
      'Allow Kallo to send your meal first.'
    );
    expect(preStreamErrorMessage(400, { error: 'Bad input' })).toBe(
      'Bad input'
    );
    expect(preStreamErrorMessage(502, null)).toBe('Request failed (502)');
  });
});
