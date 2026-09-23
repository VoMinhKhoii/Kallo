import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException }));

const { reportError } = await import('../report-error');

describe('reportError', () => {
  beforeEach(() => captureException.mockClear());

  it('sends the error as-is by default, tagged with its scope', () => {
    const error = new Error('boom');
    reportError(error, '[app]');
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { scope: '[app]' },
    });
  });

  it('redactMessage keeps type and frames but drops a multi-line message', () => {
    const error = new SyntaxError(
      'Unexpected token, "phở bò\nhai tô" is not JSON'
    );
    reportError(error, '[analyze-meal]', { redactMessage: true });

    const sent = captureException.mock.calls[0][0] as Error;
    expect(sent.name).toBe('SyntaxError');
    expect(sent.message).not.toContain('phở');
    expect(sent.stack).not.toContain('phở');
    expect(sent.stack).not.toContain('hai tô');
    expect(sent.stack).toMatch(/\n\s+at /);
  });
});
