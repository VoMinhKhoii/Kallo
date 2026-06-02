import { useCallback, useEffect, useRef, useState } from 'react';
import EventSource from 'react-native-sse';
import type { StreamEvent, StreamStatus } from '@/lib/ai/streaming/types';
import type { MealItem, ParsedMeal } from '@/lib/types/meal';
import { supabase } from '~/lib/supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export interface StreamAnalysisState {
  status: StreamStatus;
  items: string[]; // streamed dish names (item_name)
  completedItems: MealItem[]; // dishes with macros (item_macros), upserted by id
  result: ParsedMeal | null;
  analysisId: string | null;
  error: string | null;
  isAnalyzing: boolean;
}

export interface StreamAnalyzeInput {
  message: string;
  loggedDate: string;
  timezoneOffset: number;
  locale?: 'en' | 'vi';
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

// The server emits NAMED SSE events; react-native-sse routes them to named
// listeners (a generic 'message' listener would receive nothing). 'error' is a
// built-in event name — server `event: error` frames arrive at the 'error'
// listener WITH `.data`, transport errors arrive WITHOUT it.
type StreamEventName =
  | 'stage'
  | 'item_name'
  | 'item_macros'
  | 'result'
  | 'analysis_complete';
const STREAM_EVENTS: StreamEventName[] = [
  'stage',
  'item_name',
  'item_macros',
  'result',
  'analysis_complete',
];

export function useStreamAnalysis() {
  const [state, setState] = useState<StreamAnalysisState>(INITIAL_STATE);
  const esRef = useRef<EventSource<StreamEventName> | null>(null);
  const requestIdRef = useRef(0);

  const closeStream = useCallback(() => {
    esRef.current?.removeAllEventListeners();
    esRef.current?.close();
    esRef.current = null;
  }, []);

  useEffect(() => () => closeStream(), [closeStream]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1; // invalidate any in-flight handlers
    closeStream();
    setState(INITIAL_STATE);
  }, [closeStream]);

  // The streaming-state reducer, ported verbatim from the web hook.
  const apply = useCallback((event: StreamEvent, reqId: number) => {
    if (reqId !== requestIdRef.current) return;
    setState((prev) => {
      switch (event.type) {
        case 'stage':
          return { ...prev, status: event.stage };
        case 'item_name':
          return { ...prev, items: [...prev.items, event.name] };
        case 'item_macros': {
          // Upsert by run-scoped mealItemId: a retry re-emits the same slot.
          const existing = prev.completedItems.findIndex(
            (i) => i.id === event.mealItemId
          );
          const next: MealItem = { ...event.item, id: event.mealItemId };
          if (existing >= 0) {
            const updated = [...prev.completedItems];
            updated[existing] = next;
            return { ...prev, completedItems: updated };
          }
          return { ...prev, completedItems: [...prev.completedItems, next] };
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
  }, []);

  const analyze = useCallback(
    async (input: StreamAnalyzeInput) => {
      closeStream();
      const reqId = ++requestIdRef.current;
      setState({ ...INITIAL_STATE, status: 'connecting', isAnalyzing: true });

      const { data } = await supabase.auth.getSession();
      if (reqId !== requestIdRef.current) return; // superseded while awaiting
      const token = data.session?.access_token;

      const es = new EventSource<StreamEventName>(
        `${BASE_URL}/api/analyze-meal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(input),
          pollingInterval: 0, // do not auto-reconnect / re-POST
        }
      );
      esRef.current = es;

      const onNamed = (e: { data: string | null }) => {
        if (!e.data) return;
        let event: StreamEvent;
        try {
          event = JSON.parse(e.data) as StreamEvent;
        } catch {
          return;
        }
        apply(event, reqId);
        if (event.type === 'analysis_complete') closeStream();
      };
      for (const name of STREAM_EVENTS) es.addEventListener(name, onNamed);

      es.addEventListener('error', (e) => {
        const maybe = e as unknown as {
          data?: string | null;
          message?: string;
        };
        if (maybe.data) {
          // A server `event: error` terminal frame.
          try {
            apply(JSON.parse(maybe.data) as StreamEvent, reqId);
          } catch {
            // ignore malformed
          }
        } else if (reqId === requestIdRef.current) {
          // A transport/connection error.
          setState((prev) =>
            prev.status === 'done'
              ? prev
              : {
                  ...prev,
                  status: 'error',
                  error: maybe.message || 'Connection lost',
                  isAnalyzing: false,
                }
          );
        }
        closeStream();
      });
    },
    [apply, closeStream]
  );

  return { ...state, analyze, cancel, reset };
}
