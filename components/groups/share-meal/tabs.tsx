'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Whole portion versus split.
 *
 * "Nguyên phần" replaced the shipped "Cùng một món": both tabs now turn on the
 * same noun and differ by one word, whole versus divided, which is the only
 * thing that actually changes between them.
 *
 * Uses the app's Tabs primitive rather than two styled buttons. The hand-rolled
 * version this replaced had `aria-pressed` on plain buttons — no `role="tab"`,
 * no arrow-key navigation, no focus ring. The primitive is Radix-backed and
 * brings all three.
 */
export function ShareMealTabs({
  mode,
  wholeLabel,
  splitLabel,
  onChange,
  allowSplit = true,
  wholeOnlyLabel,
}: {
  mode: 'whole' | 'split';
  wholeLabel: string;
  splitLabel: string;
  onChange: (mode: 'whole' | 'split') => void;
  /** False for a cheat meal: its numbers are slider positions, not a dish that
   *  can be divided. The recipient sets their own amounts instead. */
  allowSplit?: boolean;
  /** Shown in place of the tabs when `allowSplit` is false. */
  wholeOnlyLabel?: string;
}) {
  // A sentence, not a disabled tab. A greyed-out "Chia phần" invites a tap and
  // then explains nothing; this says what will happen instead, which also
  // pre-frames the slider card the recipient is about to meet.
  if (!allowSplit) {
    return (
      <p className="mt-3.5 rounded-xl bg-kallo-hover/40 px-3 py-2 font-sans-display text-[12px] text-kallo-text-muted leading-relaxed">
        {wholeOnlyLabel}
      </p>
    );
  }

  return (
    <Tabs
      className="mt-3.5"
      onValueChange={(v) => onChange(v as 'whole' | 'split')}
      value={mode}
    >
      <TabsList className="w-full">
        <TabsTrigger value="whole">{wholeLabel}</TabsTrigger>
        <TabsTrigger value="split">{splitLabel}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
