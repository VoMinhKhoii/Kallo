'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AnalyzeOutcome,
  applyStreamEvent,
  INITIAL_STREAM_STATE,
  isTerminalEvent,
  type StreamAnalysisState,
} from '@/lib/ai/streaming/client-state';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import {
  classifyPreStreamRefusal,
  preStreamErrorMessage,
} from '@/lib/ai/streaming/pre-stream-refusal';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { ComposerPickRef } from '@/lib/domain/logging/relog/relog';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

export interface StreamAnalyzeInput {
  message: string;
  loggedDate: string;
  timezoneOffset: number;
  /** 'cheat' runs the slider estimator instead of the decomposition pipeline. */
  mode?: 'precise' | 'cheat';
  cheatType?: string;
  /** Indulgence magnitude for cheat mode — scales the slider anchor grams. */
  cheatIntensity?: 'light' | 'medium' | 'heavy';
  /** Reply to a prior vague-input clarifying question. */
  clarifyAnswer?: string;
  /** NL-refine: original meal's ISO timestamp, so the corrected meal keeps its
   *  timeline position/slot instead of being re-stamped to "now". */
  inheritLoggedAt?: string;
  /** Stable per-attempt id. Reused across re-analyses of one card so the server
   *  upserts the same staging row instead of orphaning its predecessor. */
  attemptId?: string;
  /** Combined relog: picks staged alongside free text — a past dish, a past
   *  meal, or a scanned product. Only `message` runs the AI pipeline; the
   *  server resolves these deterministically and merges them into the result
   *  before staging, so picked items are never re-analyzed. */
  refs?: ComposerPickRef[];
  /** What the saved meal is LABELLED with, beside `refs` — the composer's own
   *  sentence. `message` is that sentence with the picks cut out, so without
   *  this the server rebuilds the label and appends them, reordering it. */
  displayText?: string;
}

/** One request's end, before the consent retry decides what it means. */
type SendOutcome =
  | Exclude<AnalyzeOutcome, 'consentDeclined'>
  | 'consentRequired';

/**
 * Client-side backstop: if the SSE stream goes completely silent for this long
 * (no frame at all, and no terminal event received yet), abort and surface a
 * retryable timeout instead of spinning forever. Guards against a wedged socket
 * or proxy where the server never closes the stream. Generous enough not to
 * trip on a slow-but-progressing LLM step, which still emits stage/item frames.
 */
const INACTIVITY_MS = 45_000;

/**
 * The one transport to `/api/analyze-meal`, and the one place AI-processing
 * consent is asked for on its behalf (App Store 5.1.2(i)). Every caller —
 * submit, refine, clarify, the dashboard bar — goes through `analyze()`, so no
 * entry point can reach the provider without the gate.
 */
export function useStreamAnalysis({
  aiConsent,
}: {
  /** Asked before every request; re-asked when the server refuses for consent. */
  aiConsent: AiConsentGate;
}) {
  const [state, setState] = useState<StreamAnalysisState>(INITIAL_STREAM_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    setState(INITIAL_STREAM_STATE);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STREAM_STATE);
  }, []);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const processEvent = useCallback(
    (event: StreamEvent, thisRequestId: number) => {
      if (thisRequestId !== requestIdRef.current) return;
      setState((prev) => applyStreamEvent(prev, event));
    },
    []
  );

  const fail = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      error,
      isAnalyzing: false,
    }));
  }, []);

  /**
   * One POST and the stream it opens. Once consent was granted in this attempt
   * (`consentGranted`), a consent refusal is an ordinary error: asking again
   * could loop, and settling it as "Not now" would drop the meal silently.
   */
  const send = useCallback(
    async (
      input: StreamAnalyzeInput,
      controller: AbortController,
      thisRequestId: number,
      consentGranted: boolean
    ): Promise<SendOutcome> => {
      // Inactivity watchdog — hoisted so catch/finally can read/clear it.
      let receivedTerminal = false;
      // Whether the analysis DURABLY staged (an `analysis_complete` arrived), as
      // opposed to erroring, clarifying, or ending unexpectedly. Returned to the
      // caller so a combined relog submit only consumes its staged picks once the
      // pending row exists — an error/clarify keeps the picks in the composer.
      let durablyStaged = false;
      let timedOut = false;
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const clearWatchdog = () => {
        if (watchdog) clearTimeout(watchdog);
        watchdog = undefined;
      };
      const armWatchdog = () => {
        clearWatchdog();
        // Once terminal, the server just needs to close — its delay must not
        // trip a spurious timeout over an already-successful analysis.
        if (receivedTerminal) return;
        watchdog = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, INACTIVITY_MS);
      };
      const consume = (events: StreamEvent[]) => {
        for (const event of events) {
          if (isTerminalEvent(event)) receivedTerminal = true;
          if (event.type === 'analysis_complete') durablyStaged = true;
          processEvent(event, thisRequestId);
        }
      };

      try {
        const response = await fetch('/api/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        // Stale request check
        if (thisRequestId !== requestIdRef.current) return 'notStaged';

        // Non-200 responses come as JSON (pre-stream validation errors).
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const refusal = classifyPreStreamRefusal(response.status, body);
          // The consent refusal is the caller's to settle: it may re-ask and
          // re-send, so nothing is committed to state here.
          if (refusal === 'consentRequired' && !consentGranted) {
            return 'consentRequired';
          }
          const error = preStreamErrorMessage(response.status, body);
          // A pre-stream 402 means the AI-analysis feature is locked: a
          // distinct state so the logging surface opens the paywall rather
          // than showing a generic error toast.
          setState((prev) => ({
            ...prev,
            status: refusal === 'paymentRequired' ? 'paymentRequired' : 'error',
            error,
            isAnalyzing: false,
          }));
          return 'notStaged';
        }

        const reader = response.body?.getReader();
        if (!reader) {
          fail('No response stream available');
          return 'notStaged';
        }

        const decoder = new TextDecoder('utf-8');
        const buffer = { current: '' };

        armWatchdog();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Stale request check
          if (thisRequestId !== requestIdRef.current) {
            reader.cancel();
            return 'notStaged';
          }

          consume(
            parseSSEChunk(decoder.decode(value, { stream: true }), buffer)
          );
          // Frame arrived — reset (or, once terminal, retire) the watchdog.
          armWatchdog();
        }

        // Flush any remaining data in decoder
        const finalChunk = decoder.decode();
        if (finalChunk) consume(parseSSEChunk(finalChunk, buffer));

        // If stream ended without a terminal event, treat as error
        if (
          !receivedTerminal &&
          thisRequestId === requestIdRef.current &&
          !controller.signal.aborted
        ) {
          fail('Analysis stream ended unexpectedly');
        }
      } catch (error) {
        // Stale request — ignore
        if (thisRequestId !== requestIdRef.current) return 'notStaged';

        if (error instanceof DOMException && error.name === 'AbortError') {
          // The watchdog aborted a silent, un-terminated stream — surface it as
          // a retryable timeout. A user-initiated cancel() leaves timedOut
          // false and stays silent.
          if (timedOut) fail('Analysis timed out. Please try again.');
          return 'notStaged';
        }

        fail(error instanceof Error ? error.message : 'Failed to analyze meal');
      } finally {
        clearWatchdog();
      }
      // True only if an `analysis_complete` arrived; error/clarify/unexpected
      // end leave it false so a combined relog submit keeps its staged picks.
      return durablyStaged ? 'staged' : 'notStaged';
    },
    [fail, processEvent]
  );

  const analyze = useCallback(
    async (input: StreamAnalyzeInput): Promise<AnalyzeOutcome> => {
      // Cancel any in-flight request
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const thisRequestId = ++requestIdRef.current;
      const isCurrent = () =>
        thisRequestId === requestIdRef.current && !controller.signal.aborted;

      setState({
        ...INITIAL_STREAM_STATE,
        status: 'connecting',
        isAnalyzing: true,
      });

      // "Not now": nothing was sent. The caller takes back whatever it put on
      // screen for this request; the state says why.
      const declined = (): AnalyzeOutcome => {
        if (!isCurrent()) return 'notStaged';
        setState({ ...INITIAL_STREAM_STATE, status: 'consentRequired' });
        return 'consentDeclined';
      };

      // Nothing reaches the AI provider before the user has agreed. Read
      // before asking: not on record means a "true" is a "Continue" just now.
      const askedNow = !aiConsent.consented;
      if (!(await aiConsent.ensure())) return declined();
      if (!isCurrent()) return 'notStaged';

      const outcome = await send(input, controller, thisRequestId, askedNow);
      if (outcome !== 'consentRequired') return outcome;
      // The server has no consent on record — withdrawn on another device, or
      // this page was stale. Ask once more: "Continue" re-sends this same
      // request, "Not now" ends here without asking again.
      if (!isCurrent()) return 'notStaged';
      if (!(await aiConsent.onRequired())) return declined();
      if (!isCurrent()) return 'notStaged';
      const resent = await send(input, controller, thisRequestId, true);
      // Unreachable: with consent granted, a refusal already failed as error.
      return resent === 'consentRequired' ? 'notStaged' : resent;
    },
    [aiConsent, send]
  );

  return {
    ...state,
    analyze,
    cancel,
    reset,
  };
}
