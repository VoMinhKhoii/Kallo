import { expect, it } from 'vitest';
import { GET } from '@/app/data/meal-calorie-variation.csv/route';
import { mealDataCsv } from '@/lib/seo/meal-data/download/download';

it('serves the observations as a UTF-8 CSV attachment', async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(await response.text()).toBe(mealDataCsv());
});
