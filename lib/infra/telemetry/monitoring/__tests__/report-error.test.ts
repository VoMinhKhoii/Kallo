import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException }));

const { reportError } = await import('../report-error');

/** The SDK is imported on first report, so the call lands a tick later. */
const flushSentryImport = () =>
  vi.waitFor(() => expect(captureException).toHaveBeenCalled());

describe('reportError', () => {
  beforeEach(() => captureException.mockClear());

  it('sends the error as-is by default, tagged with its scope', async () => {
    const error = new Error('boom');
    reportError(error, '[app]');
    await flushSentryImport();
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { scope: '[app]' },
    });
  });

  it('redactMessage keeps type and frames but drops a multi-line message', async () => {
    const error = new SyntaxError(
      'Unexpected token, "phở bò\nhai tô" is not JSON'
    );
    reportError(error, '[analyze-meal]', { redactMessage: true });
    await flushSentryImport();

    const sent = captureException.mock.calls[0][0] as Error;
    expect(sent.name).toBe('SyntaxError');
    expect(sent.message).not.toContain('phở');
    expect(sent.stack).not.toContain('phở');
    expect(sent.stack).not.toContain('hai tô');
    expect(sent.stack).toMatch(/\n\s+at /);
  });

  it('passes a fingerprint through, so each value is its own Sentry issue', async () => {
    const error = new Error('brake tripped');
    reportError(error, '[ai-spend-brake]', {
      fingerprint: ['ai-spend-brake', '2026-10-25'],
    });
    await flushSentryImport();
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { scope: '[ai-spend-brake]' },
      fingerprint: ['ai-spend-brake', '2026-10-25'],
    });
  });
});
