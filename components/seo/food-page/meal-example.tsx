import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import type { DishRowsMeal } from '@/components/logging/feed/persisted/meal-details';
import { PersistedMealBody } from '@/components/logging/feed/persisted/persisted-meal-body';
import { UserMessageBubble } from '@/components/logging/feed/turn/user-message-bubble';
import type { FoodPageVariant } from '@/lib/seo/food-pages/pages';

/** The meal card's dish rows, from a captured meal. */
function dishRowsOf(variant: FoodPageVariant): DishRowsMeal {
  return {
    mealItemGroups: variant.dishes.map((dish, order) => ({
      order,
      name: dish.name,
      nutrition: {
        caloriesKcal: dish.calories,
        proteinG: dish.protein,
        carbohydrateG: dish.carbs,
        fatG: dish.fat,
      },
    })),
  };
}

function totalsOf(variant: FoodPageVariant) {
  const sum = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    variant.dishes.reduce((total, dish) => total + dish[key], 0);
  return {
    calories: formatCaloriesOrNA(sum('calories')),
    protein: formatMacroOrNA(sum('protein')),
    carbs: formatMacroOrNA(sum('carbs')),
    fat: formatMacroOrNA(sum('fat')),
  };
}

/**
 * One logged meal as the app shows it: the user's message bubble, then the
 * saved meal card opened to its dish rows and Total.
 */
export function MealExample({
  label,
  variant,
}: {
  label: string;
  variant: FoodPageVariant;
}) {
  return (
    <section className="mt-12">
      <h3 className="mb-4 font-semibold text-h4 text-kallo-text">{label}</h3>
      <div className="mb-3">
        <UserMessageBubble text={variant.text} />
      </div>
      {/* The saved meal card's shell (precise-meal-card.tsx), as in the feed. */}
      <div className="rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-sm sm:p-5">
        <p className="font-sans-display text-kallo-text text-sm leading-relaxed">
          {variant.text}
        </p>
        <PersistedMealBody
          meal={dishRowsOf(variant)}
          isCollapsed={false}
          totals={totalsOf(variant)}
        />
      </div>
    </section>
  );
}
