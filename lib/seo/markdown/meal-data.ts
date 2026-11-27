import { getTranslations } from 'next-intl/server';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { FOOD_PAGE_PREFIX, type FoodLocale } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY } from '@/lib/seo/meal-data/copy';
import { formatRatio, mealData } from '@/lib/seo/meal-data/facts';
import {
  MEAL_DATA_CSV_PATH,
  MEAL_DATA_JSON_PATH,
  MEAL_DATA_LICENSE,
  MEAL_DATA_PATH,
} from '@/lib/seo/meal-data/path';
import type { MealSwing } from '@/lib/seo/meal-data/stats';
import { SITE_URL } from '@/lib/seo/site';
import { bullets, link, pageUrl, paragraphs } from './blocks';

/**
 * The `text/markdown` form of the meal-variation data page, from the same
 * copy and computed facts as `app/[locale]/data/meal-calorie-variation/`.
 * The CSV and JSON downloads are linked, not inlined: they are the data.
 */

function swingLines(locale: FoodLocale, swings: MealSwing[]): string[] {
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
  const copy = MEAL_DATA_COPY[locale];
  return bullets(
    swings.map(
      (s) =>
        // A hard line break, as the page sets the meals under the numbers.
        `${link(s.page.name, pageUrl(locale, `${FOOD_PAGE_PREFIX}/${s.page.slug}`))} — ${formatNumber(s.low)}–${formatNumber(s.high)} kcal · ${formatRatio(locale, s.ratio)}×  \n  ${copy.swingLine(s.lowLabel, s.highLabel)}`
    )
  );
}

export async function renderMealDataMarkdown(
  locale: FoodLocale
): Promise<string> {
  const copy = MEAL_DATA_COPY[locale];
  const { facts, swings, kinds } = mealData(locale);
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const url = pageUrl(locale, MEAL_DATA_PATH);

  return [
    `# ${copy.title}`,
    '',
    `> ${copy.description(facts)}`,
    '',
    copy.lead(facts),
    '',
    `## ${copy.swingsHeading}`,
    '',
    copy.swingsLead,
    '',
    ...swingLines(locale, swings.slice(0, 10)),
    '',
    `## ${copy.kindsHeading}`,
    '',
    copy.kindsLead,
    '',
    ...bullets(
      kinds.map(
        (k) =>
          `**${copy.kinds[k.key]}** — ${copy.kindLine(k.meals, formatNumber(k.medianKcal), formatNumber(k.maxKcal))}`
      )
    ),
    '',
    `## ${copy.oilHeading}`,
    '',
    copy.oilBody(facts),
    '',
    `## ${copy.steadyHeading}`,
    '',
    copy.steadyLead,
    '',
    ...swingLines(locale, swings.slice(-5).reverse()),
    '',
    `## ${copy.methodHeading}`,
    '',
    ...paragraphs(copy.method(facts)),
    `## ${copy.downloadHeading}`,
    '',
    ...paragraphs([
      copy.downloadNote,
      copy.downloadDates(facts),
      `${link('CSV', `${SITE_URL}${MEAL_DATA_CSV_PATH}`)} · ${link('JSON', `${SITE_URL}${MEAL_DATA_JSON_PATH}`)}`,
      link(copy.downloadLicense, MEAL_DATA_LICENSE),
    ]),
    `## ${copy.citeHeading}`,
    '',
    ...paragraphs([
      copy.cite(facts, url),
      copy.tryLine,
      link(t('getStarted'), pageUrl(locale, '')),
    ]),
  ].join('\n');
}
