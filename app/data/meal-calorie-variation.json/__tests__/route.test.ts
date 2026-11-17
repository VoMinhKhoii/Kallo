import { expect, it } from 'vitest';
import { GET } from '@/app/data/meal-calorie-variation.json/route';
import { mealDataDownload } from '@/lib/seo/meal-data/download/download';

it('serves metadata and observations as JSON', async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(await response.json()).toEqual(mealDataDownload());
});
