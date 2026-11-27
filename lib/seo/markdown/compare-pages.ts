import { getTranslations } from 'next-intl/server';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import { ALTERNATIVE_PAGES } from '@/lib/seo/alternatives/pages';
import {
  ALTERNATIVES_LOCALE,
  type AlternativeSlug,
  alternativePath,
} from '@/lib/seo/alternatives/slugs';
import type { Source } from '@/lib/seo/alternatives/types';
import { COMPARE_CHROME } from '@/lib/seo/compare/chrome';
import { COMPARE_PAGES, compareSlugFor } from '@/lib/seo/compare/pages';
import {
  COMPARE_LOCALE,
  type CompareSlug,
  comparePath,
} from '@/lib/seo/compare/slugs';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { bullets, link, pageUrl, paragraphs, table } from './blocks';

/**
 * The `text/markdown` form of the "Kallo vs" and alternatives pages, from the
 * same copy the HTML renders (`app/[locale]/compare/`, `alternatives/`). Both
 * are English only and share the vendor-article frame: title, the date the
 * facts were checked, the answer, the disclosure, the body, the try line.
 */

interface Frame {
  title: string;
  description: string;
  checkedOn: string;
  answer: string;
  disclosure: string;
  tryLine: string;
}

/** Kallo's own sources are docs paths without the locale, as the HTML links them. */
function sourceLine(locale: string, sources: Source[]): string {
  const url = (s: Source) =>
    s.url.startsWith('/') ? pageUrl(locale, s.url) : s.url;
  return `${ALTERNATIVES_CHROME.labels.sources}: ${sources
    .map((s) => link(s.label, url(s)))
    .join(', ')}`;
}

async function article(
  locale: string,
  frame: Frame,
  body: string[]
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  return [
    `# ${frame.title}`,
    '',
    `> ${frame.description}`,
    '',
    ALTERNATIVES_CHROME.checked(frame.checkedOn),
    '',
    ...paragraphs([frame.answer, `*${frame.disclosure}*`]),
    ...body,
    ...paragraphs([frame.tryLine, link(t('getStarted'), pageUrl(locale, ''))]),
  ].join('\n');
}

export async function renderCompareMarkdown(
  slug: CompareSlug
): Promise<string> {
  const page = COMPARE_PAGES[slug];
  const locale = COMPARE_LOCALE;
  const { facts } = mealData(locale);
  const pick = (heading: string, items: string[]) => [
    `## ${heading}`,
    '',
    ...bullets(items),
    '',
  ];

  return article(locale, page, [
    ...table(
      ['', `Kallo (${ALTERNATIVES_CHROME.labels.ours})`, page.them],
      page.rows.map((row) => [row.label, row.kallo, row.them])
    ),
    '',
    ...page.sections.flatMap((section) => [
      `## ${section.heading}`,
      '',
      ...paragraphs(section.body),
    ]),
    ...pick(COMPARE_CHROME.pickThem(page.them), page.pickThem),
    ...pick(COMPARE_CHROME.pickKallo, page.pickKallo),
    `## ${page.dataHeading}`,
    '',
    ...paragraphs([
      `${page.data(facts)} ${link(COMPARE_CHROME.dataLink, pageUrl(locale, MEAL_DATA_PATH))}`,
      link(
        COMPARE_CHROME.alternativesLink(page.them),
        pageUrl(locale, alternativePath(page.alternatives))
      ),
      link(
        COMPARE_CHROME.switchingLink,
        pageUrl(locale, ALTERNATIVES_CHROME.docs.switching)
      ),
    ]),
    `## ${COMPARE_CHROME.methodHeading}`,
    '',
    ...paragraphs([...page.method, sourceLine(locale, page.sources)]),
  ]);
}

export async function renderAlternativeMarkdown(
  slug: AlternativeSlug
): Promise<string> {
  const page = ALTERNATIVE_PAGES[slug];
  const locale = ALTERNATIVES_LOCALE;
  const { facts } = mealData(locale);
  const { tableHeads: heads, labels } = ALTERNATIVES_CHROME;
  const vs = compareSlugFor(slug);

  const options = page.options.flatMap((option) => [
    `## ${option.name}: ${option.headline}${option.ours ? ` (${labels.ours})` : ''}`,
    '',
    ...paragraphs(option.body),
    ...bullets([
      `**${labels.logs}:** ${option.logs}`,
      `**${labels.free}:** ${option.free}`,
      `**${labels.paid}:** ${option.paid}`,
      `**${labels.platforms}:** ${option.platforms}`,
      `**${labels.bestFor}:** ${option.bestFor}`,
      `**${labels.drawback}:** ${option.drawback}`,
    ]),
    '',
    sourceLine(locale, option.sources),
    '',
  ]);

  return article(locale, page, [
    ...table(
      [heads.app, heads.logs, heads.free, heads.paid],
      page.options.map((o) => [
        o.ours ? `${o.name} (${labels.ours})` : o.name,
        o.logs,
        o.free,
        o.paid,
      ])
    ),
    '',
    `## ${page.leaveHeading}`,
    '',
    ...paragraphs([...page.leave, sourceLine(locale, page.leaveSources)]),
    ...options,
    ...(page.extra
      ? [`## ${page.extra.heading}`, '', ...paragraphs(page.extra.body)]
      : []),
    `## ${page.choose.heading}`,
    '',
    ...bullets(page.choose.checks),
    '',
    ...(vs
      ? paragraphs([
          link(
            COMPARE_CHROME.compareLink(COMPARE_PAGES[vs].them),
            pageUrl(locale, comparePath(vs))
          ),
        ])
      : []),
    `## ${page.dataHeading}`,
    '',
    ...paragraphs([
      `${page.data(facts)} ${link(page.dataLink, pageUrl(locale, MEAL_DATA_PATH))}`,
    ]),
    `## ${page.methodHeading}`,
    '',
    ...paragraphs(page.method),
  ]);
}
