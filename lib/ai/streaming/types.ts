import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { MealItem, ParsedMeal } from '@/lib/core/types/meal';

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
  /**
   * Run-scoped compact meal-item ID (§0.1). Stable across retries so the client
   * can correlate streamed names to later `item_macros` events for the
   * same logical slot, even when the same display name appears twice
   * (e.g., two servings of "cơm trắng" in one meal).
   */
  mealItemId: string;
}

/** Single meal item with macros estimated during nutrition streaming */
export interface ItemMacrosEvent {
  type: 'item_macros';
  /**
   * Run-scoped compact meal-item ID (§0.1). Matches the `mealItemId` carried by
   * the prior `item_name` event for the same logical slot. Used by the
   * client to upsert macros onto the correct streamed name (§4.4 — retry
   * replacement safety).
   */
  mealItemId: string;
  item: MealItem;
}

/** Final display-optimized result for the client */
export interface ResultEvent {
  type: 'result';
  data: ParsedMeal;
}

/**
 * Cheat-meal result — a slider spec instead of a finalized meal. The client
 * renders interactive sliders and resolves nutrition locally; the chosen
 * levels are sent on confirm. Replaces `result` on the cheat path.
 */
export interface CheatEstimateEvent {
  type: 'cheat_estimate';
  spec: CheatSliderSpec;
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
  | CheatEstimateEvent
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
  | 'error'
  // Pre-stream 402: the analyze endpoint reported the AI-analysis feature is
  // locked (trial expired / not entitled). The logging surface surfaces the
  // paywall instead of a generic error toast.
  | 'paymentRequired';
