import { mealDataCsv } from '@/lib/seo/meal-data/download/download';

export function GET(): Response {
  return new Response(mealDataCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="meal-calorie-variation.csv"',
    },
  });
}
