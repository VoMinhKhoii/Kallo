import { getTranslations } from 'next-intl/server';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import {
  breakdownOf,
  type FoodPage,
  groupName,
  kcalSpan,
  pagesByGroup,
  relatedPages,
  similarCaloriePages,
  sourcesOf,
} from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  type FoodLocale,
} from '@/lib/seo/food-pages/slugs';
import type { FoodPageVariant } from '@/lib/seo/food-pages/types';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { toolPath } from '@/lib/seo/tools/slugs';
import {
  bullets,
  link,
  linkedSentence,
  pageUrl,
  paragraphs,
  table,
} from './blocks';

/**
 * The `text/markdown` form of the food hub and of each food page, built from
 * the same copy and captures the HTML pages render (`app/[locale]/calories/`),
 * in the same order. The numbers are the captured ones; nothing is recomputed
 * beyond the totals the meal cards already show.
 */

// The meal card's formats (`formatCaloriesValue` / `formatMacroValue` in
// components/logging/feed/format-inline-nutrition.ts, which lib cannot import).
const kcal = (n: number) => `${Math.round(n)} kcal`;
const grams = (n: number) => `${Math.round(n)}g`;

function totalsOf(variant: FoodPageVariant) {
  const sum = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    variant.dishes.reduce((total, dish) => total + dish[key], 0);
  return [
    kcal(sum('calories')),
    grams(sum('protein')),
    grams(sum('carbs')),
    grams(sum('fat')),
  ];
}

/** "Chicken burrito — 300 to 1,000 kcal", linked: the rows of `FoodLinkList`. */
export function foodPageLinks(pages: FoodPage[]): string[] {
  return bullets(
    pages.map(
      (page) =>
        `${link(page.name, pageUrl(page.locale, `${FOOD_PAGE_PREFIX}/${page.slug}`))} — ${kcalSpan(page.capture, page.locale)} kcal`
    )
  );
}

export function renderFoodHubMarkdown(locale: FoodLocale): string {
  const chrome = FOOD_PAGE_CHROME[locale];
  const lines = [
    `# ${chrome.hub.heading}`,
    '',
    `> ${chrome.hub.description(FOOD_SLUGS[locale].length)}`,
    '',
    chrome.hub.intro,
    '',
    link(chrome.dataLink, pageUrl(locale, MEAL_DATA_PATH)),
    '',
  ];
  for (const { group, pages } of pagesByGroup(locale)) {
    lines.push(
      `## ${groupName(locale, group)}`,
      '',
      ...foodPageLinks(pages),
      ''
    );
  }
  return lines.join('\n');
}

function mealSections(page: FoodPage, totalLabel: string): string[] {
  const heads = FOOD_PAGE_CHROME[page.locale].tableHeads;
  return page.meals.flatMap((meal) => {
    const variant = page.capture.variants.find((v) => v.key === meal.key);
    if (!variant) return [];
    const rows = variant.dishes.map((dish) => [
      dish.name,
      kcal(dish.calories),
      grams(dish.protein),
      grams(dish.carbs),
      grams(dish.fat),
    ]);
    return [
      `### ${meal.label}`,
      '',
      `> ${variant.text}`,
      '',
      ...table(
        [heads.meal, heads.calories, heads.protein, heads.carbs, heads.fat],
        [...rows, [`**${totalLabel}**`, ...totalsOf(variant)]],
        [1, 2, 3, 4]
      ),
      '',
    ];
  });
}

export async function renderFoodPageMarkdown(page: FoodPage): Promise<string> {
  const { locale } = page;
  const chrome = FOOD_PAGE_CHROME[locale];
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  const card = await getTranslations({
    locale,
    namespace: 'logging.persistedMealCard',
  });
  const span = kcalSpan(page.capture, locale);
  const loggedOn = chrome.formatDate(new Date(page.capture.capturedAt));
  const { facts } = mealData(locale);
  const heads = chrome.tableHeads;

  const summary = page.meals.flatMap((meal) => {
    const variant = page.capture.variants.find((v) => v.key === meal.key);
    return variant ? [[meal.label, ...totalsOf(variant)]] : [];
  });

  return [
    `# ${page.title}`,
    '',
    `> ${page.description(span)}`,
    '',
    chrome.loggedOn(loggedOn),
    '',
    page.lead(span),
    '',
    ...table(
      [heads.meal, heads.calories, heads.protein, heads.carbs, heads.fat],
      summary,
      [1, 2, 3, 4]
    ),
    '',
    linkedSentence(
      chrome.rangeNote,
      chrome.rangeNote.link(facts.dishes, facts.ratio),
      pageUrl(locale, MEAL_DATA_PATH)
    ),
    '',
    ...mealSections(page, card('total')),
    `## ${chrome.movesHeading}`,
    '',
    page.breakdownLead,
    '',
    ...bullets(
      breakdownOf(page).map(
        (i) => `${i.name} · ${Math.round(i.grams)} g — ${kcal(i.kcal)}`
      )
    ),
    '',
    `## ${chrome.sourcesHeading}`,
    '',
    ...paragraphs([
      chrome.sourcesBody(loggedOn, sourcesOf(page)),
      linkedSentence(
        chrome.dailyNote,
        chrome.dailyNote.link,
        pageUrl(locale, toolPath('tdee-calculator'))
      ),
    ]),
    `## ${chrome.moreHeading}`,
    '',
    ...foodPageLinks(relatedPages(page)),
    '',
    `## ${chrome.similarHeading}`,
    '',
    ...foodPageLinks(similarCaloriePages(page)),
    '',
    ...paragraphs([
      linkedSentence(
        chrome.browse,
        chrome.browse.link(FOOD_SLUGS[locale].length),
        pageUrl(locale, FOOD_PAGE_PREFIX)
      ),
      page.tryLine,
      link(t('getStarted'), pageUrl(locale, '')),
    ]),
  ].join('\n');
}
