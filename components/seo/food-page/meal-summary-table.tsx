import { DocsTable, DocsTd, DocsTh } from '@/components/docs/mdx/prose-blocks';
import type { FoodPageChrome } from '@/lib/seo/food-pages/page-copy';
import type { FoodPageMeal, FoodPageVariant } from '@/lib/seo/food-pages/types';
import { totalsOf } from './meal-example';

// Tighter than a docs table so all five columns fit a phone without scrolling.
// `DocsTd` drops the rule on each row's last cell; this table rules every row
// but the last.
const HEAD = 'px-2 sm:px-4';
const CELL =
  'px-2 text-sm last:border-b sm:px-4 sm:text-base [tr:last-child_&]:border-0';
const NUMBER = `${CELL} whitespace-nowrap tabular-nums`;

/**
 * Every version of the meal on one table, above the cards. It is what a reader
 * came for, and a real `<table>` is what search engines and assistants lift
 * into an answer; the cards below show how each number was reached.
 */
export function MealSummaryTable({
  meals,
  variants,
  heads,
}: {
  meals: FoodPageMeal[];
  variants: FoodPageVariant[];
  heads: FoodPageChrome['tableHeads'];
}) {
  const rows = meals.flatMap((meal) => {
    const variant = variants.find((v) => v.key === meal.key);
    return variant ? [{ meal, totals: totalsOf(variant) }] : [];
  });

  return (
    <DocsTable>
      <thead>
        <tr>
          <DocsTh className={HEAD}>{heads.meal}</DocsTh>
          <DocsTh className={HEAD}>{heads.calories}</DocsTh>
          <DocsTh className={HEAD}>{heads.protein}</DocsTh>
          <DocsTh className={HEAD}>{heads.carbs}</DocsTh>
          <DocsTh className={HEAD}>{heads.fat}</DocsTh>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ meal, totals }) => (
          <tr key={meal.key}>
            <DocsTd className={CELL}>{meal.label}</DocsTd>
            <DocsTd className={NUMBER}>{totals.calories}</DocsTd>
            <DocsTd className={NUMBER}>{totals.protein}</DocsTd>
            <DocsTd className={NUMBER}>{totals.carbs}</DocsTd>
            <DocsTd className={NUMBER}>{totals.fat}</DocsTd>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
