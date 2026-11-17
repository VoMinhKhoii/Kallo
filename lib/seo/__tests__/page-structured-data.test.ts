import { describe, expect, it } from 'vitest';
import {
  foodPageStructuredData,
  hubStructuredData,
  mealDataStructuredData,
  toolStructuredData,
} from '@/lib/seo/page-structured-data';

type Node = Record<string, unknown>;
const nodes = (data: { '@graph': object[] }) => data['@graph'] as Node[];
const typed = (data: { '@graph': object[] }, type: string) =>
  nodes(data).find((node) => node['@type'] === type) as Node;

const food = foodPageStructuredData({
  locale: 'en',
  url: 'https://kallo.fit/en/calories/pad-thai',
  title: 'How many calories are in pad thai?',
  description: 'About 400 to 900 kcal.',
  hubName: 'Calories in meals',
  hubPath: '/en/calories',
  name: 'Pad thai',
  capturedAt: '2026-11-01T10:00:00.000Z',
});

describe('page structured data', () => {
  it('gives a food page a breadcrumb whose last crumb has no URL', () => {
    const items = typed(food, 'BreadcrumbList').itemListElement as Node[];
    expect(items.map((item) => item.name)).toEqual([
      'Kallo',
      'Calories in meals',
      'Pad thai',
    ]);
    expect(items[1].item).toBe('https://kallo.fit/en/calories');
    expect(items[2]).not.toHaveProperty('item');
  });

  it('dates a food page by its capture and credits one publisher', () => {
    const article = typed(food, 'Article');
    expect(article.dateModified).toBe('2026-11-01T10:00:00.000Z');
    expect(article.publisher).toMatchObject({
      '@id': 'https://kallo.fit/#organization',
    });
  });

  it('never marks a logged meal up as a recipe', () => {
    expect(JSON.stringify(food)).not.toMatch(/Recipe|NutritionInformation/);
  });

  it('numbers a hub list from 1', () => {
    const hub = hubStructuredData({
      locale: 'vi',
      name: 'Calo',
      items: [{ name: 'Phở', url: 'https://kallo.fit/vi/calories/pho-bo' }],
    });
    const list = typed(hub, 'ItemList');
    expect(list.numberOfItems).toBe(1);
    expect((list.itemListElement as Node[])[0].position).toBe(1);
  });

  it('marks a calculator free', () => {
    const tool = toolStructuredData({
      locale: 'en',
      url: 'https://kallo.fit/en/tools/bmi-calculator',
      name: 'BMI calculator',
      description: 'd',
      hubName: 'Calculators',
      hubPath: '/en/tools',
    });
    expect(typed(tool, 'WebApplication').isAccessibleForFree).toBe(true);
  });

  it('gives the data page a day-precise coverage and no licence claim', () => {
    const dataset = typed(
      mealDataStructuredData({
        locale: 'en',
        url: 'https://kallo.fit/en/data/meal-calorie-variation',
        name: 'n',
        description: 'd',
        first: '2026-11-01T10:00:00.000Z',
        last: '2026-11-02T10:00:00.000Z',
      }),
      'Dataset'
    );
    expect(dataset.temporalCoverage).toBe('2026-11-01/2026-11-02');
    expect(dataset).not.toHaveProperty('license');
  });
});
