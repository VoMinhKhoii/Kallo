import { NutritionSkeleton } from '@/components/nutrition/nutrition-skeleton';

export default function NutritionLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <p className="px-5 pt-6 font-serif text-nham-text-muted text-sm sm:px-8 lg:px-12">
        Gathering your pattern…
      </p>
      <NutritionSkeleton />
    </div>
  );
}
