import type { MealItem } from '@/lib/core/types/meal';

/**
 * One frame of the ticker; a new `key` flips the text in place.
 *
 * `phase` frames are the app talking about itself and carry the cycling action
 * verbs; `item`/`macros` frames carry the meal's own words (serif italic), with
 * `detail` as the resolved kcal.
 */
export interface StreamTickerFrame {
  key: string;
  kind: 'phase' | 'item' | 'macros';
  text: string;
  detail?: string;
  /**
   * The pipeline stage this frame was derived in, which is what the verbs are
   * keyed on. Carried by dish frames too: between dishes the line falls back to
   * the stage's verbs, and without it the first name detected during
   * `decomposing` would hold the line for the rest of the run.
   *
   * Null for frames with no stage behind them (saving), which show `text`.
   */
  stage: string | null;
}

/** What the ticker reads off a live analysis, however it was carried there. */
export interface StreamTickerSource {
  isAnalyzing: boolean;
  status: string;
  /** Dish names as they are detected (decomposing), newest last. */
  items: string[];
  /** Dishes with resolved macros (estimating), newest last. */
  completedItems: MealItem[];
}

/**
 * The ONE line the ticker shows, derived from the stream rather than
 * accumulated.
 *
 * The pipeline emits names (decomposing) before macros (estimating), so
 * precedence is: latest resolved item > latest named item > the stage itself.
 * Assembling is excluded from the dish branches — by then the dishes are old
 * news and the line should say what is still happening.
 *
 * Shared by the dashboard's input bar and the logging feed so the two cannot
 * tell different stories about the same run.
 */
export function deriveStreamTicker(
  stream: StreamTickerSource
): StreamTickerFrame | null {
  if (!stream.isAnalyzing) return null;
  if (stream.status !== 'assembling') {
    const done = stream.completedItems.at(-1);
    if (done) {
      return {
        key: `done-${done.id}`,
        kind: 'macros',
        text: done.name,
        detail: `${Math.round(done.macros.calories)} kcal`,
        stage: stream.status,
      };
    }
    const name = stream.items.at(-1);
    if (name) {
      return {
        key: `name-${stream.items.length}`,
        kind: 'item',
        text: `${name}…`,
        stage: stream.status,
      };
    }
  }
  return {
    key: `phase-${stream.status}`,
    kind: 'phase',
    text: '',
    stage: stream.status,
  };
}
