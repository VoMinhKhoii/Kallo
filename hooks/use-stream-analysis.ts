'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent, StreamStatus } from '@/lib/ai/streaming/types';
import type { MealItem, ParsedMeal } from '@/lib/types/meal';

export interface StreamAnalysisState {
  status: StreamStatus;
  items: string[];
  completedItems: MealItem[];
  result: ParsedMeal | null;
  analysisId: string | null;
  error: string | null;
  isAnalyzing: boolean;
}

const INITIAL_STATE: StreamAnalysisState = {
  status: 'idle',
  items: [],
  completedItems: [],
  result: null,
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
            // Upsert: replace if item.id already exists (handles retry re-emit)
            const existing = prev.completedItems.findIndex(
              (i) => i.id === event.item.id
            );
            if (existing >= 0) {
              const updated = [...prev.completedItems];
              updated[existing] = event.item;
              return { ...prev, completedItems: updated };
            }
            return {
              ...prev,
              completedItems: [...prev.completedItems, event.item],
            };
          }

          case 'result':
            return { ...prev, result: event.data };

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
    async (message: string) => {
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
          body: JSON.stringify({ message }),
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
            if (event.type === 'analysis_complete' || event.type === 'error') {
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
            if (event.type === 'analysis_complete' || event.type === 'error') {
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
