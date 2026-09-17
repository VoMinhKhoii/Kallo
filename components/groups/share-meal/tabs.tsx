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
}: {
  mode: 'whole' | 'split';
  wholeLabel: string;
  splitLabel: string;
  onChange: (mode: 'whole' | 'split') => void;
}) {
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
