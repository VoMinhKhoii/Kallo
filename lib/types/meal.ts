export interface MacroBreakdown {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  macros: MacroBreakdown;
}

export interface ParsedMeal {
  mealName: string;
  items: MealItem[];
  totalMacros: MacroBreakdown;
}

/** A user override of a dish's total cooked weight, sent to the server on confirm. */
export interface MealQuantityEdit {
  mealItemOrder: number;
  newGrams: number;
}

/**
 * Precise-mode clarify prompt: the pipeline finished but an ingredient's
 * portion/food couldn't be resolved. The stream ends here (no analysis_complete);
 * the client re-submits the meal with `clarifyAnswer`.
 */
export interface PreciseClarify {
  question: string;
  mealItemId?: string;
  reason: 'unresolved_portion' | 'ambiguous_food';
}

export type ChatRole = 'user' | 'assistant';

export type StreamingPhase =
  | 'waiting'
  | 'decomposing'
  | 'matching'
  | 'estimating'
  | 'assembling'
  | 'done';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  parsedMeal?: ParsedMeal;
  userInput?: string;
  timestamp: Date;
  loggedDate?: string;
  isStreaming?: boolean;
  streamingPhase?: StreamingPhase;
  streamingItems?: string[];
  streamingCompletedItems?: MealItem[];
  analysisId?: string;
  /** Stable per-attempt id minted when this card's analysis starts. Reused when
   *  the card is re-analyzed (cheat-clarify, refine) so the server supersedes
   *  the prior staging row instead of leaving a duplicate "unsaved" card. */
  attemptId?: string;
  /** Cheat-meal slider spec — set on a finalized cheat message. */
  cheatSpec?: import('./cheat').CheatSliderSpec;
  /** Precise-mode clarify prompt — set when the pipeline settled on a single
   *  question (portion/food unresolved) instead of a meal. The card collects a
   *  free-text answer and re-analyzes the same text with `clarifyAnswer`. */
  preciseClarify?: PreciseClarify;
  /** Timeline anchor carried from an NL-refine's origin meal, so a clarify
   *  round-trip on the refine keeps `inheritLoggedAt`. Absent on normal logs. */
  inheritLoggedAt?: string;
}
