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
  /** Cheat-meal slider spec — set on a finalized cheat message. */
  cheatSpec?: import('./cheat').CheatSliderSpec;
}
