import type { StreamEvent, StreamStatus } from '@/lib/ai/streaming/types';
import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { MealItem, ParsedMeal } from '@/lib/core/types/meal';

/**
 * The browser's view of one analysis stream, and the pure fold that moves it
 * frame by frame. `useStreamAnalysis` owns the transport; this is the state it
 * transports into, kept free of React so it can be read in one sitting.
 */
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

/**
 * How one `analyze()` call ended, for the caller that put something on screen
 * before it: `staged` — an `analysis_complete` arrived, the card is confirmable;
 * `consentDeclined` — the user said "Not now" to AI processing, so NOTHING was
 * sent and whatever the caller added optimistically is its own to take back;
 * `notStaged` — any other end (error, clarify, cancel, superseded).
 */
export type AnalyzeOutcome = 'staged' | 'consentDeclined' | 'notStaged';

export const INITIAL_STREAM_STATE: StreamAnalysisState = {
  status: 'idle',
  items: [],
  completedItems: [],
  result: null,
  cheatSpec: null,
  analysisId: null,
  error: null,
  isAnalyzing: false,
};

/**
 * Terminal events end the SSE stream with no follow-up frame: a durable
 * `analysis_complete`, a fatal `error`, or a cheat `cheat_estimate` carrying a
 * clarifyingQuestion (the vague-input fallback).
 *
 * Anything else the server may emit is NOT terminal here: the stream closing
 * after it settles as "ended unexpectedly", i.e. a retryable failed attempt.
 */
export function isTerminalEvent(event: StreamEvent): boolean {
  return (
    event.type === 'analysis_complete' ||
    event.type === 'error' ||
    (event.type === 'cheat_estimate' && event.spec.clarifyingQuestion != null)
  );
}

/** Fold one server frame into the state. */
export function applyStreamEvent(
  prev: StreamAnalysisState,
  event: StreamEvent
): StreamAnalysisState {
  switch (event.type) {
    case 'stage':
      return { ...prev, status: event.stage };

    case 'item_name':
      return { ...prev, items: [...prev.items, event.name] };

    case 'item_macros': {
      // Upsert keyed by run-scoped mealItemId (§0.1, §4.4): retry re-emits the
      // same logical slot, so replace by id rather than append.
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

    case 'cheat_estimate':
      // A clarifying-question spec ends the stream with no analysis_complete
      // (client must re-ask), so settle isAnalyzing here. A full spec keeps
      // streaming until analysis_complete.
      return event.spec.clarifyingQuestion
        ? { ...prev, cheatSpec: event.spec, status: 'done', isAnalyzing: false }
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

    // Any event type this client does not consume (e.g. server frames added
    // for other clients) is skipped without touching state.
    default:
      return prev;
  }
}
