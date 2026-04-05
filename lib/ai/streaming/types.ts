import type { MealItem, ParsedMeal } from '@/lib/types/meal';

// ---------------------------------------------------------------------------
// SSE Event Types — contract between route handler and client consumer
// ---------------------------------------------------------------------------

/**
 * Pipeline stages emitted as progress updates.
 * Each stage fires exactly once, in order.
 */
export type PipelineStage =
  | 'authenticating'
  | 'decomposing'
  | 'matching'
  | 'estimating'
  | 'assembling';

/** Progress update — which pipeline stage is active */
export interface StageEvent {
  type: 'stage';
  stage: PipelineStage;
  message?: string;
}

/** Single meal item name discovered during decomposition streaming */
export interface ItemNameEvent {
  type: 'item_name';
  name: string;
  index: number;
}

/** Single meal item with macros estimated during nutrition streaming */
export interface ItemMacrosEvent {
  type: 'item_macros';
  item: MealItem;
}

/** Final display-optimized result for the client */
export interface ResultEvent {
  type: 'result';
  data: ParsedMeal;
}

/** Analysis stored durably — safe to confirm and persist */
export interface AnalysisCompleteEvent {
  type: 'analysis_complete';
  analysisId: string;
}

/** Error during streaming — terminal event */
export interface StreamErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Union of all SSE event types.
 *
 * Terminal event contract:
 * - Exactly ONE of `analysis_complete` or `error` is the final event.
 * - After a terminal event, the stream closes.
 */
export type StreamEvent =
  | StageEvent
  | ItemNameEvent
  | ItemMacrosEvent
  | ResultEvent
  | AnalysisCompleteEvent
  | StreamErrorEvent;

// ---------------------------------------------------------------------------
// Client-side stream state
// ---------------------------------------------------------------------------

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | PipelineStage
  | 'done'
  | 'error';
