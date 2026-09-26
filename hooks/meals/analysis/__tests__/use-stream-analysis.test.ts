import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type StreamAnalyzeInput,
  useStreamAnalysis,
} from '@/hooks/meals/analysis/use-stream-analysis';
import type { AnalyzeOutcome } from '@/lib/ai/streaming/client-state';
import { encodeSSE } from '@/lib/ai/streaming/encoder';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

const input: StreamAnalyzeInput = {
  message: 'Phở bò',
  loggedDate: '2026-09-25',
  timezoneOffset: 0,
};

const consentRefusal = () =>
  Response.json(
    {
      error: {
        code: 'ai_consent_required',
        message: 'Allow AI processing first.',
        retryable: false,
      },
    },
    { status: 403 }
  );

const staged = () =>
  new Response(
    encodeSSE({ type: 'analysis_complete', analysisId: 'analysis-1' }),
    { status: 200 }
  );

function gate(
  answers: { consented?: boolean; ensure?: boolean; onRequired?: boolean } = {}
) {
  return {
    consented: answers.consented ?? true,
    ensure: vi.fn(async () => answers.ensure ?? true),
    onRequired: vi.fn(async () => answers.onRequired ?? false),
  } satisfies AiConsentGate;
}

async function analyzeWith(aiConsent: AiConsentGate) {
  const { result } = renderHook(() => useStreamAnalysis({ aiConsent }));
  let outcome: AnalyzeOutcome | undefined;
  await act(async () => {
    outcome = await result.current.analyze(input);
  });
  return { outcome, state: result.current };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStreamAnalysis — the AI-processing consent gate', () => {
  it('asks before sending, and sends nothing on "Not now"', async () => {
    const aiConsent = gate({ ensure: false });

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.ensure).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).toBe('consentDeclined');
    expect(state.status).toBe('consentRequired');
    expect(state.isAnalyzing).toBe(false);
  });

  it('treats a plain 403 as an error — no consent prompt', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    const aiConsent = gate();

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.onRequired).not.toHaveBeenCalled();
    expect(outcome).toBe('notStaged');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Request failed (403)');
  });

  it('keeps a 402 as paymentRequired', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { code: 'feature_locked', message: 'Upgrade' } },
        { status: 402 }
      )
    );
    const aiConsent = gate();

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.onRequired).not.toHaveBeenCalled();
    expect(outcome).toBe('notStaged');
    expect(state.status).toBe('paymentRequired');
  });

  it('re-asks on a server consent refusal and ends there on "Not now"', async () => {
    fetchMock.mockResolvedValueOnce(consentRefusal());
    const aiConsent = gate({ onRequired: false });

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.onRequired).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(outcome).toBe('consentDeclined');
    expect(state.status).toBe('consentRequired');
  });

  it('re-sends the same request once after "Continue"', async () => {
    fetchMock
      .mockResolvedValueOnce(consentRefusal())
      .mockResolvedValueOnce(staged());
    const aiConsent = gate({ onRequired: true });

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toBe(
      fetchMock.mock.calls[0][1].body
    );
    expect(outcome).toBe('staged');
    expect(state.status).toBe('done');
    expect(state.analysisId).toBe('analysis-1');
  });

  it('never loops: a second refusal after "Continue" is an error, not a decline', async () => {
    fetchMock
      .mockResolvedValueOnce(consentRefusal())
      .mockResolvedValueOnce(consentRefusal());
    const aiConsent = gate({ onRequired: true });

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.onRequired).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Not `consentDeclined`: that takes the meal back off the screen as if
    // the user had said "Not now". An error keeps it, with the toast.
    expect(outcome).toBe('notStaged');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Allow AI processing first.');
  });

  it('a refusal right after the first "Continue" is an error, with no re-ask', async () => {
    fetchMock.mockResolvedValueOnce(consentRefusal());
    // Not on record, so `ensure()` asked and the user tapped "Continue".
    const aiConsent = gate({ consented: false, ensure: true });

    const { outcome, state } = await analyzeWith(aiConsent);

    expect(aiConsent.ensure).toHaveBeenCalledOnce();
    expect(aiConsent.onRequired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(outcome).toBe('notStaged');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Allow AI processing first.');
  });
});
