'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent, StreamStatus } from '@/lib/ai/streaming/types';
import type {
  KnownDetailInput,
  LoggingMode,
  MealContext,
  PortionCertainty,
} from '@/lib/logging/manual-estimation';
import type { CheatSliderSpec } from '@/lib/types/cheat';
import type { MealItem, ParsedMeal } from '@/lib/types/meal';

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
  loggingMode?: LoggingMode;
  portionCertainty?: PortionCertainty;
  mealContext?: MealContext;
  knownDetails?: KnownDetailInput[];
  /** 'cheat' runs the slider estimator instead of the decomposition pipeline. */
  mode?: 'precise' | 'cheat';
  cheatType?: string;
  /** Indulgence magnitude for cheat mode — scales the slider anchor grams. */
  cheatIntensity?: 'light' | 'medium' | 'heavy';
  /** Reply to a prior vague-input clarifying question. */
  clarifyAnswer?: string;
}

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

          default:
            return prev;
        }
      });
    },
    []
  );

  const analyze = useCallback(
    async (input: StreamAnalyzeInput) => {
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

      try {
        const response = await fetch('/api/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        // Stale request check
        if (thisRequestId !== requestIdRef.current) return;

        // Non-200 responses come as JSON (pre-stream validation errors)
        // Error body may be structured { error: { code, message, ... } } or legacy { error: "string" }
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const errorMsg =
            typeof body?.error === 'string'
              ? body.error
              : (body?.error?.message ?? `Request failed (${response.status})`);
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: errorMsg,
            isAnalyzing: false,
          }));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'No response stream available',
            isAnalyzing: false,
          }));
          return;
        }

        const decoder = new TextDecoder('utf-8');
        const buffer = { current: '' };
        let receivedTerminal = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Stale request check
          if (thisRequestId !== requestIdRef.current) {
            reader.cancel();
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          const events = parseSSEChunk(chunk, buffer);

          for (const event of events) {
            if (
              event.type === 'analysis_complete' ||
              event.type === 'error' ||
              (event.type === 'cheat_estimate' &&
                event.spec.clarifyingQuestion != null)
            ) {
              receivedTerminal = true;
            }
            processEvent(event, thisRequestId, requestIdRef);
          }
        }

        // Flush any remaining data in decoder
        const finalChunk = decoder.decode();
        if (finalChunk) {
          const events = parseSSEChunk(finalChunk, buffer);
          for (const event of events) {
            if (
              event.type === 'analysis_complete' ||
              event.type === 'error' ||
              (event.type === 'cheat_estimate' &&
                event.spec.clarifyingQuestion != null)
            ) {
              receivedTerminal = true;
            }
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
        // Stale request or aborted — ignore
        if (thisRequestId !== requestIdRef.current) return;
        if (error instanceof DOMException && error.name === 'AbortError')
          return;

        setState((prev) => ({
          ...prev,
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Failed to analyze meal',
          isAnalyzing: false,
        }));
      }
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
