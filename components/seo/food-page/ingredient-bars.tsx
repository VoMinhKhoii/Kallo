import type { FoodPageVariant } from '@/lib/seo/food-pages/types';

/** One bar per ingredient, each scaled to the largest. */
export function IngredientBars({
  ingredients,
}: {
  ingredients: FoodPageVariant['ingredients'];
}) {
  const maxKcal = Math.max(1, ...ingredients.map((i) => i.kcal));
  return (
    <div className="mt-6 space-y-3">
      {ingredients.map((ingredient, index) => (
        <div
          key={`${ingredient.name}-${index}`}
          className="font-sans-display text-[13px]"
        >
          <div className="flex justify-between">
            <span className="font-medium text-kallo-text">
              {ingredient.name}{' '}
              <span className="font-normal text-kallo-text-muted">
                · {ingredient.grams} g
              </span>
            </span>
            <span className="font-bold text-kallo-text tabular-nums">
              {ingredient.kcal} kcal
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-kallo-track">
            <div
              className="h-full rounded-full bg-kallo-text"
              style={{ width: `${(ingredient.kcal / maxKcal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
