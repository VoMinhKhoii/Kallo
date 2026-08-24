import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The `text/markdown` representation of the landing page.
 *
 * Built from the same `landing` messages the page renders, not hand-written, so
 * a copy change cannot leave the agent-facing version describing a product that
 * no longer exists. The pieces that live in component code rather than messages
 * — the worked macro numbers on the hero cards, the per-plan feature lists —
 * are deliberately not reproduced here; they are linked to instead. A number
 * duplicated into a second source is a number that will eventually be wrong.
 */

const MEAL_KEYS = ['pho', 'bol', 'chicken', 'shake'] as const;
const DETAIL_KEYS = ['fat', 'count', 'weight', 'oil'] as const;

export async function renderLandingMarkdown(locale: Locale): Promise<string> {
  const meta = await getTranslations({ locale, namespace: 'metadata.root' });
  const t = await getTranslations({ locale, namespace: 'landing' });

  const base = `${SITE_URL}/${locale}`;
  const lines: string[] = [
    `# ${meta('title')}`,
    '',
    `> ${meta('description')}`,
    '',
    `**${t('hero.headline.clause1.lead')} ${t('hero.headline.clause1.word')}, ${t('hero.headline.clause2.lead')} ${t('hero.headline.clause2.word')}.**`,
    '',
    t('hero.subtitle'),
    '',
    t('hero.beta'),
    '',
    '## Meals you can describe',
    '',
  ];

  for (const key of MEAL_KEYS) {
    lines.push(`- "${t(`hero.meals.${key}.input`)}"`);
  }

  lines.push(
    '',
    `## ${t('understanding.titleLead')} ${t('understanding.titleUnderlined')}`,
    ''
  );
  for (const key of DETAIL_KEYS) {
    lines.push(
      `- **${t(`understanding.categories.${key}.title`)}** — ${t(`understanding.categories.${key}.note`)}`
    );
  }

  lines.push('', `## ${t('pricing.title')}`, '');
  lines.push(
    `- **${t('pricing.plans.free.name')}** (${t('pricing.plans.free.price')}) — ${t('pricing.plans.free.tagline')}. ${t('pricing.plans.free.fineprint')}`,
    `- **${t('pricing.plans.premium.name')}** (${t('pricing.plans.premium.priceMonthly')}/mo, or ${t('pricing.plans.premium.priceYearly')}/mo billed yearly) — ${t('pricing.plans.premium.tagline')}. ${t('pricing.plans.premium.fineprintYearly')}`,
    `- **${t('pricing.plans.lifetime.name')}** (${t('pricing.plans.lifetime.price')}) — ${t('pricing.plans.lifetime.tagline')}. ${t('pricing.plans.lifetime.fineprint')}`,
    '',
    t('pricing.betaNote'),
    '',
    `Full plan comparison: [${base}/docs/account/premium](${base}/docs/account/premium)`,
    '',
    '## Where to go next',
    '',
    `- [Documentation index](${SITE_URL}/llms.txt) — every page, one link per line`,
    `- [What Kallo is](${base}/docs/overview)`,
    `- [Log your first meal](${base}/docs/quickstart)`,
    `- [How estimates work](${base}/docs/estimates/how-it-works)`,
    `- [For developers and agents](${base}/docs/developers/agents)`,
    `- [OpenAPI specification](${SITE_URL}/openapi.json)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    ''
  );

  return lines.join('\n');
}
