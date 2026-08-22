'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent, StreamStatus } from '@/lib/ai/streaming/types';
import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { MealItem, ParsedMeal } from '@/lib/core/types/meal';
import type { RelogRef } from '@/lib/domain/logging/relog/relog';

export interface StreamAnalysisState {
  status: StreamStatus;
  items: string[];
  completedItems: MealItem[];
  result: ParsedMeal | null;
  /** Cheat-meal slider spec (when mode='cheat'); replaces `result`. */
  cheatSpec: CheatSliderSpec | null;
  analysisId: string | null;
  error: string | null;
  isAnalyzing: boolean;
}

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
  /** Combined relog: picks staged alongside free text. Only `message` runs the
   *  AI pipeline; the server resolves these deterministically and merges them
   *  into the result before staging, so relogged dishes are never re-analyzed. */
  refs?: RelogRef[];
}

/**
 * Terminal events end the SSE stream with no follow-up frame: a durable
 * `analysis_complete`, a fatal `error`, or a cheat `cheat_estimate` carrying a
 * clarifyingQuestion (the vague-input fallback).
 *
 * Anything else the server may emit is NOT terminal here: the stream closing
 * after it settles as "ended unexpectedly", i.e. a retryable failed attempt.
 */
function isTerminalEvent(event: StreamEvent): boolean {
  return (
    event.type === 'analysis_complete' ||
    event.type === 'error' ||
    (event.type === 'cheat_estimate' && event.spec.clarifyingQuestion != null)
  );
}

/**
 * Client-side backstop: if the SSE stream goes completely silent for this long
 * (no frame at all, and no terminal event received yet), abort and surface a
 * retryable timeout instead of spinning forever. Guards against a wedged socket
 * or proxy where the server never closes the stream. Generous enough not to
 * trip on a slow-but-progressing LLM step, which still emits stage/item frames.
 */
const INACTIVITY_MS = 45_000;

const INITIAL_STATE: StreamAnalysisState = {
  status: 'idle',
  items: [],
  completedItems: [],
  result: null,
  cheatSpec: null,
  analysisId: null,
  error: null,
  isAnalyzing: false,
};

export function useStreamAnalysis() {
  const [state, setState] = useState<StreamAnalysisState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const processEvent = useCallback(
    (
      event: StreamEvent,
      thisRequestId: number,
      reqIdRef: React.RefObject<number>
    ) => {
      if (thisRequestId !== reqIdRef.current) return;

      setState((prev) => {
        switch (event.type) {
          case 'stage':
            return { ...prev, status: event.stage };

          case 'item_name':
            return { ...prev, items: [...prev.items, event.name] };

          case 'item_macros': {
            // Upsert keyed by run-scoped mealItemId (§0.1, §4.4): retry
            // re-emits the same logical slot, so replace by id rather
            // than append.
            const existing = prev.completedItems.findIndex(
              (i) => i.id === event.mealItemId
            );
            const next: MealItem = { ...event.item, id: event.mealItemId };
            if (existing >= 0) {
              const updated = [...prev.completedItems];
              updated[existing] = next;
              return { ...prev, completedItems: updated };
            }
            return {
              ...prev,
              completedItems: [...prev.completedItems, next],
            };
          }

          case 'result':
            return { ...prev, result: event.data };

          case 'cheat_estimate':
            // A clarifying-question spec ends the stream with no
            // analysis_complete (client must re-ask), so settle isAnalyzing
            // here. A full spec keeps streaming until analysis_complete.
            return event.spec.clarifyingQuestion
              ? {
                  ...prev,
                  cheatSpec: event.spec,
                  status: 'done',
                  isAnalyzing: false,
                }
              : { ...prev, cheatSpec: event.spec };

          case 'analysis_complete':
            return {
              ...prev,
              status: 'done',
              analysisId: event.analysisId,
              isAnalyzing: false,
            };

          case 'error':
            return {
              ...prev,
              status: 'error',
              error: event.message,
              isAnalyzing: false,
            };

          // Any event type this client does not consume (e.g. server frames
          // added for other clients) is skipped without touching state.
          default:
            return prev;
        }
      });
    },
    []
  );

  const analyze = useCallback(
    async (input: StreamAnalyzeInput): Promise<boolean> => {
      // Cancel any in-flight request
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const thisRequestId = ++requestIdRef.current;

      setState({
        ...INITIAL_STATE,
        status: 'connecting',
        isAnalyzing: true,
      });

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

      try {
        const response = await fetch('/api/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        // Stale request check
        if (thisRequestId !== requestIdRef.current) return false;

        // Non-200 responses come as JSON (pre-stream validation errors)
        // Error body may be structured { error: { code, message, ... } } or legacy { error: "string" }
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const errorMsg =
            typeof body?.error === 'string'
              ? body.error
              : (body?.error?.message ?? `Request failed (${response.status})`);

          // A pre-stream 402 means the AI-analysis feature is locked. Surface a
          // distinct state so the logging surface opens the paywall rather than
          // showing a generic error toast. Keyed on the HTTP status; the body
          // (code 'feature_locked', feature, reason) is parsed defensively but
          // the status alone is authoritative.
          if (response.status === 402) {
            setState((prev) => ({
              ...prev,
              status: 'paymentRequired',
              error: errorMsg,
              isAnalyzing: false,
            }));
            return false;
          }

          setState((prev) => ({
            ...prev,
            status: 'error',
            error: errorMsg,
            isAnalyzing: false,
          }));
          return false;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'No response stream available',
            isAnalyzing: false,
          }));
          return false;
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
            return false;
          }

          const chunk = decoder.decode(value, { stream: true });
          const events = parseSSEChunk(chunk, buffer);

          for (const event of events) {
            if (isTerminalEvent(event)) {
              receivedTerminal = true;
            }
            if (event.type === 'analysis_complete') durablyStaged = true;
            processEvent(event, thisRequestId, requestIdRef);
          }

          // Frame arrived — reset (or, once terminal, retire) the watchdog.
          armWatchdog();
        }

        // Flush any remaining data in decoder
        const finalChunk = decoder.decode();
        if (finalChunk) {
          const events = parseSSEChunk(finalChunk, buffer);
          for (const event of events) {
            if (isTerminalEvent(event)) {
              receivedTerminal = true;
            }
            if (event.type === 'analysis_complete') durablyStaged = true;
            processEvent(event, thisRequestId, requestIdRef);
          }
        }

        // If stream ended without a terminal event, treat as error
        if (
          !receivedTerminal &&
          thisRequestId === requestIdRef.current &&
          !controller.signal.aborted
        ) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Analysis stream ended unexpectedly',
            isAnalyzing: false,
          }));
        }
      } catch (error) {
        // Stale request — ignore
        if (thisRequestId !== requestIdRef.current) return false;

        if (error instanceof DOMException && error.name === 'AbortError') {
          // The watchdog aborted a silent, un-terminated stream — surface it as
          // a retryable timeout. A user-initiated cancel() leaves timedOut
          // false and stays silent.
          if (timedOut) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: 'Analysis timed out. Please try again.',
              isAnalyzing: false,
            }));
          }
          return false;
        }

        setState((prev) => ({
          ...prev,
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Failed to analyze meal',
          isAnalyzing: false,
        }));
      } finally {
        clearWatchdog();
      }
      // Reached only on the normal (non-early-return) completion path. True only
      // if an `analysis_complete` arrived; error/clarify/unexpected-end leave it
      // false so a combined relog submit keeps its staged picks.
      return durablyStaged;
    },
    [processEvent]
  );

  return {
    ...state,
    analyze,
    cancel,
    reset,
  };
}
