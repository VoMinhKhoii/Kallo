import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { kcalSpan } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { HUB_COPY, TOOL_COPY } from '@/lib/seo/tools/content';
import { exampleMealPages } from '@/lib/seo/tools/example-meals';
import {
  TOOL_SLUGS,
  TOOLS_PREFIX,
  type ToolSlug,
  toolPath,
} from '@/lib/seo/tools/slugs';
import { bullets, link, linkedSentence, pageUrl, paragraphs } from './blocks';

/**
 * The `text/markdown` form of the calculators hub and each calculator page.
 * The calculator itself runs in the browser, so the Markdown carries the
 * method around it: the sections, the example meals and the sources.
 */

function toolLinks(locale: Locale, slugs: readonly ToolSlug[]): string[] {
  return bullets(
    slugs.map((slug) => {
      const copy = TOOL_COPY[locale][slug];
      return `${link(copy.name, pageUrl(locale, toolPath(slug)))} — ${copy.blurb}`;
    })
  );
}

export function renderToolsHubMarkdown(locale: Locale): string {
  const hub = HUB_COPY[locale];
  const lines = [
    `# ${hub.title}`,
    '',
    `> ${hub.description}`,
    '',
    hub.lead,
    '',
    ...toolLinks(locale, TOOL_SLUGS),
    '',
  ];
  if (hub.foodLine && isFoodLocale(locale)) {
    lines.push(link(hub.foodLine, pageUrl(locale, FOOD_PAGE_PREFIX)), '');
  }
  return lines.join('\n');
}

export async function renderToolMarkdown(
  locale: Locale,
  slug: ToolSlug
): Promise<string> {
  const copy = TOOL_COPY[locale][slug];
  const hub = HUB_COPY[locale];
  const t = await getTranslations({ locale, namespace: 'landing.header' });

  const lines = [
    `# ${copy.title}`,
    '',
    `> ${copy.description}`,
    '',
    copy.lead,
    '',
  ];
  for (const section of copy.sections) {
    lines.push(`## ${section.heading}`, '', ...paragraphs(section.paragraphs));
  }

  if (isFoodLocale(locale)) {
    const browse = FOOD_PAGE_CHROME[locale].browse;
    lines.push(
      `## ${hub.exampleMeals.heading}`,
      '',
      hub.exampleMeals.lead,
      '',
      ...bullets(
        exampleMealPages(locale, slug).map(
          (page) =>
            `${link(page.name, pageUrl(locale, `${FOOD_PAGE_PREFIX}/${page.slug}`))} — ${kcalSpan(page.capture, locale)} kcal`
        )
      ),
      '',
      linkedSentence(
        browse,
        browse.link(FOOD_SLUGS[locale].length),
        pageUrl(locale, FOOD_PAGE_PREFIX)
      ),
      ''
    );
  }

  lines.push(
    `## ${hub.sourcesHeading}`,
    '',
    ...bullets(copy.sources.map((s) => link(s.label, s.href))),
    '',
    `## ${hub.more}`,
    '',
    ...toolLinks(
      locale,
      TOOL_SLUGS.filter((s) => s !== slug)
    ),
    '',
    link(hub.title, pageUrl(locale, TOOLS_PREFIX)),
    '',
    ...paragraphs([hub.tryLine, link(t('getStarted'), pageUrl(locale, ''))])
  );
  return lines.join('\n');
}
