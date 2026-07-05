import { describe, expect, it } from 'vitest';
import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';

describe('submitFeedbackSchema', () => {
  it('accepts a minimal bug report', () => {
    const parsed = submitFeedbackSchema.parse({
      type: 'bug',
      message: 'The camera crashes on scan.',
    });
    expect(parsed.type).toBe('bug');
    expect(parsed.message).toBe('The camera crashes on scan.');
  });

  it('trims the message and rejects an empty one', () => {
    expect(
      submitFeedbackSchema.parse({ type: 'idea', message: '  hi  ' }).message
    ).toBe('hi');
    expect(() =>
      submitFeedbackSchema.parse({ type: 'idea', message: '   ' })
    ).toThrow();
  });

  it('rejects an unknown feedback type', () => {
    expect(() =>
      submitFeedbackSchema.parse({ type: 'complaint', message: 'x' })
    ).toThrow();
  });

  it('rejects an unknown platform', () => {
    expect(() =>
      submitFeedbackSchema.parse({
        type: 'bug',
        message: 'x',
        platform: 'windows',
      })
    ).toThrow();
  });

  it('strips a client-supplied userId (never trusted)', () => {
    const parsed = submitFeedbackSchema.parse({
      type: 'bug',
      message: 'x',
      userId: 'attacker-controlled',
    } as Record<string, unknown>);
    expect('userId' in parsed).toBe(false);
  });

  it('rejects a message over the 4000-char cap', () => {
    expect(() =>
      submitFeedbackSchema.parse({ type: 'bug', message: 'a'.repeat(4001) })
    ).toThrow();
  });
});
