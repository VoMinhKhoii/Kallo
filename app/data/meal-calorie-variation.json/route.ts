import { mealDataDownload } from '@/lib/seo/meal-data/download/download';

export function GET(): Response {
  return Response.json(mealDataDownload());
}
