import type { ManualMealRow } from '@/lib/domain/logging/manual-logging';

/**
 * The imperative contract the composer textarea exposes to whatever drives it.
 *
 * A shared contract rather than a component detail: the feed, the relog
 * composer and the manual-submit path all hold a ref to the input and read or
 * write it directly, so the shape lives where both the component and the hooks
 * can depend on it without state depending on presentation.
 */
export interface MealInputHandle {
  getText: () => string;
  getManualRows: () => ManualMealRow[];
  clear: () => void;
  focus: () => void;
  /** `caret` places the cursor after the write — used when a `/` mention token
   *  is spliced out mid-sentence, so the cursor stays where the token was
   *  instead of jumping to the end. Omit it to leave the caret alone. */
  setText: (text: string, caret?: number) => void;
  /** The raw element, for callers that need `value` + `selectionStart` (the
   *  relog `/` picker). Exposed rather than lifting the text into React state,
   *  which would cost the uncontrolled textarea its draft/resize/IME behaviour. */
  getTextarea: () => HTMLTextAreaElement | null;
}
