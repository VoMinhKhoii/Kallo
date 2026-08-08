/**
 * Grams-aware pair comparison.
 *
 * A macro delta only means something if the SHARED food weighed the same in
 * both variants. Otherwise the "modifier effect" is partly a portion
 * difference. This prints per-ingredient grams side by side so drift is
 * visible before any number reaches a landing page.
 */
import { readFileSync } from 'node:fs';

type Row = {
  category: string;
  locale: string;
  variant: string;
  text: string;
  parsed: { totalMacros: { calories: number; protein: number; carbs: number; fat: number } };
  raw: {
    mealItems: Array<{
      ingredients: Array<{
        ingredientName: string;
        estimatedGrams?: number;
        foodCompositionId?: string;
        boundedNutrition?: { fatG?: { mid: number } };
      }>;
    }>;
  };
};

const d = JSON.parse(readFileSync('scripts/eval/landing-v2.json', 'utf8'));
const byKey: Record<string, Row> = d.byKey;

const ingredientsOf = (r: Row) =>
  r.raw.mealItems.flatMap((mi) => mi.ingredients);

const groups = new Map<string, Row[]>();
for (const r of Object.values(byKey)) {
  const g = `${r.category}.${r.locale}`;
  groups.set(g, [...(groups.get(g) ?? []), r]);
}

for (const [group, rows] of [...groups.entries()].sort()) {
  if (rows.length < 2) continue;
  console.log(`\n${'─'.repeat(88)}\n${group}`);

  // Union of ingredient names across variants, so an ingredient that appears
  // in one variant but not the other is visible rather than silently absent.
  const names = [
    ...new Set(rows.flatMap((r) => ingredientsOf(r).map((i) => i.ingredientName))),
  ];

  const header = ['ingredient'.padEnd(20), ...rows.map((r) => r.variant.padStart(16))].join('');
  console.log(header);
  for (const name of names) {
    // Grams AND fat density. Density (g fat per 100g of that ingredient) is
    // portion-independent, so it answers the question the card actually makes:
    // did the modifier change the FOOD, or just how much of it was served?
    const cells = rows.map((r) => {
      const ing = ingredientsOf(r).find((i) => i.ingredientName === name);
      if (!ing) return '—'.padStart(16);
      const g = ing.estimatedGrams ?? 0;
      const fat = ing.boundedNutrition?.fatG?.mid;
      const per100 = g > 0 && fat !== undefined ? (fat * 100) / g : undefined;
      return `${Math.round(g)}g ${per100 !== undefined ? `(${per100.toFixed(1)})` : '(—)'}`.padStart(16);
    });
    console.log(name.slice(0, 19).padEnd(20) + cells.join(''));
  }
  console.log('  (n) = g fat per 100g of that ingredient — portion-independent');

  const totals = rows.map((r) => r.parsed.totalMacros);
  console.log(
    'TOTAL kcal'.padEnd(20) +
      totals.map((t) => String(Math.round(t.calories)).padStart(14)).join('')
  );
  console.log(
    'TOTAL fat'.padEnd(20) +
      totals.map((t) => `${Math.round(t.fat)}g`.padStart(14)).join('')
  );
  console.log(
    'TOTAL protein'.padEnd(20) +
      totals.map((t) => `${Math.round(t.protein)}g`.padStart(14)).join('')
  );
  console.log(
    'TOTAL carbs'.padEnd(20) +
      totals.map((t) => `${Math.round(t.carbs)}g`.padStart(14)).join('')
  );

  // Weight-normalised totals: every variant scaled to the FIRST variant's total
  // food weight. This separates "the adjustment changed the food" from "the
  // model served a different amount", which raw totals conflate.
  const weightOf = (r: Row) =>
    ingredientsOf(r).reduce((sum, i) => sum + (i.estimatedGrams ?? 0), 0);
  const baseWeight = weightOf(rows[0]);
  console.log(
    'total food weight'.padEnd(20) +
      rows.map((r) => `${Math.round(weightOf(r))}g`.padStart(16)).join('')
  );
  console.log(
    `norm. kcal @${Math.round(baseWeight)}g`.padEnd(20) +
      rows
        .map((r) => {
          const w = weightOf(r);
          const scaled = w > 0 ? (r.parsed.totalMacros.calories * baseWeight) / w : 0;
          return String(Math.round(scaled)).padStart(16);
        })
        .join('')
  );
  console.log(
    'norm. fat'.padEnd(20) +
      rows
        .map((r) => {
          const w = weightOf(r);
          const scaled = w > 0 ? (r.parsed.totalMacros.fat * baseWeight) / w : 0;
          return `${scaled.toFixed(1)}g`.padStart(16);
        })
        .join('')
  );

  // Flag shared ingredients whose grams moved by more than 10%.
  const shared = names.filter((n) =>
    rows.every((r) => ingredientsOf(r).some((i) => i.ingredientName === n))
  );
  const drifted = shared.filter((n) => {
    const g = rows.map(
      (r) => ingredientsOf(r).find((i) => i.ingredientName === n)?.estimatedGrams ?? 0
    );
    const lo = Math.min(...g);
    const hi = Math.max(...g);
    return lo > 0 && (hi - lo) / lo > 0.1;
  });
  console.log(
    drifted.length === 0
      ? '  ✓ shared ingredients held their weight'
      : `  ✗ PORTION DRIFT >10%: ${drifted.join(', ')}`
  );
}
