import type {
  CheatSliderKey,
  CheatSlidersPersisted,
} from '@/lib/core/types/cheat';
import {
  activeAnchorLabel,
  clampLevel,
} from '@/lib/domain/cheat/slider-nutrition';

/**
 * One slider, as a shared cheat meal shows it to a friend: the axis, where the
 * logger put it, and the word that sits under that position.
 */
export interface CheatRecapRow {
  key: CheatSliderKey;
  label: string;
  level: number;
  /** The authored anchor at or below `level` — "vừa phải", "khá nhiều". */
  anchorLabel: string;
}

/**
 * Resolve a stored `cheat_sliders` payload into the recap the circle feed
 * renders. `null` for anything that is not a usable cheat payload.
 *
 * Derived on the SERVER rather than shipping `cheat_sliders` itself, because
 * the two differ by about 5x for no visible gain. The stored payload carries
 * six anchors per slider with their gram values — roughly 1.6 KB — and the
 * recap draws exactly one of those anchors' labels and none of the grams. At
 * a feed page of 20 (`THREAD_PAGE_SIZE`) that is ~31 KB against ~6 KB, and
 * mobile re-polls the feed every 30s (`kCirclePollInterval`), so the
 * difference is paid over and over for bytes nobody looks at.
 *
 * It also keeps the AI's full authored spec — anchors, gram anchors, the
 * clarifying question — off a payload that fans out to every friend.
 *
 * Reuses `activeAnchorLabel`, the same function the owner's own card renders
 * from (`cheat-meal-card.tsx`), so a post and its author's card cannot
 * disagree about where a slider landed.
 */
export function toCheatRecap(cheatSliders: unknown): CheatRecapRow[] | null {
  // Shape-checked rather than cast. This runs on EVERY feed read, across every
  // row ever written, so a legacy payload — `{spec}` with no `levels`, `{}`,
  // a string — must degrade to "no recap" instead of throwing and taking the
  // whole feed down with it.
  if (typeof cheatSliders !== 'object' || cheatSliders === null) return null;
  const { spec, levels } = cheatSliders as Partial<CheatSlidersPersisted>;
  if (!Array.isArray(spec?.sliders)) return null;

  const chosen = typeof levels === 'object' && levels !== null ? levels : {};

  const rows = spec.sliders.flatMap((slider) => {
    if (!slider?.key || !Array.isArray(slider.anchors)) return [];
    // An axis the logger never touched still has a position: the estimator's
    // default is what their meal was actually computed from.
    const level = clampLevel(chosen[slider.key] ?? slider.defaultLevel);
    return [
      {
        key: slider.key,
        label: slider.label ?? '',
        level,
        anchorLabel: activeAnchorLabel(slider, level),
      },
    ];
  });

  return rows.length > 0 ? rows : null;
}
