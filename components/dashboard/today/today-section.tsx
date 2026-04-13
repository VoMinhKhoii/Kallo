import type { MealEntry, NutritionData } from '@/components/dashboard/types';
import { CalorieRing } from '@/components/shared/calorie-ring';
import { MacroBars } from '@/components/shared/macro-bars';
import { MealList } from './meal-list';

interface TodaySectionProps {
  nutrition: NutritionData;
  meals: MealEntry[];
}

const MACRO_ITEMS = (nutrition: NutritionData) => [
  {
    label: 'Protein',
    current: nutrition.protein.current,
    target: nutrition.protein.target,
    color: 'var(--nham-macro-protein)',
    unit: 'g' as const,
  },
  {
    label: 'Carbs',
    current: nutrition.carbs.current,
    target: nutrition.carbs.target,
    color: 'var(--nham-macro-carbs)',
    unit: 'g' as const,
  },
  {
    label: 'Fat',
    current: nutrition.fat.current,
    target: nutrition.fat.target,
    color: 'var(--nham-macro-fat)',
    unit: 'g' as const,
  },
];

export function TodaySection({ nutrition, meals }: TodaySectionProps) {
  return (
    <div className="flex h-full items-stretch gap-5">
      {/* Left: CalorieRing + MacroBars — no card */}
      <div className="flex flex-1 items-center gap-5">
        <CalorieRing
          current={nutrition.calories.current}
          target={nutrition.calories.target}
        />
        <MacroBars items={MACRO_ITEMS(nutrition)} />
      </div>

      {/* Right: Meal list — in card */}
      <div className="w-[36%] min-w-0 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <MealList meals={meals} />
      </div>
    </div>
  );
}
