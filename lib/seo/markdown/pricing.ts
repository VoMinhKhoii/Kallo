import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { link, pageUrl } from './blocks';

/**
 * The plans as Markdown: a section of the landing page's Markdown, and the
 * whole of `/pricing`'s, which renders the same `PricingSection`. Built from
 * the `landing.pricing` messages, every word in the page's language; the
 * per-plan feature lists live in component code, so they are linked (the
 * docs' plan comparison), not copied.
 *
 * Free and Premium only, as the page shows them (`PLAN_IDS` in
 * `components/landing-page/pricing/plans.ts`): Lifetime cannot be bought on
 * the web, so quoting its price would offer a plan nobody can buy here.
 */
export async function pricingLines(locale: Locale): Promise<string[]> {
  const t = await getTranslations({ locale, namespace: 'landing.pricing' });
  const premium = pageUrl(locale, '/docs/account/premium');
  const per = t('perMonth');
  return [
    `- **${t('plans.free.name')}** (${t('plans.free.price')}) — ${t('plans.free.tagline')}. ${t('plans.free.fineprint')}`,
    `- **${t('plans.premium.name')}** — ${t('plans.premium.tagline')}.`,
    `  - ${t('period.monthly')}: ${t('plans.premium.priceMonthly')}${per}. ${t(
      'plans.premium.fineprintMonthlyNoIntro',
      { price: t('plans.premium.billedMonthly') }
    )}`,
    `  - ${t('period.yearly')}: ${t('plans.premium.priceYearly')}${per}. ${t(
      'plans.premium.fineprintYearlyNoIntro',
      { price: t('plans.premium.billedYearly') }
    )}`,
    '',
    t('offerNote'),
    '',
    link(`${t('plans.premium.name')}: ${premium}`, premium),
  ];
}

export async function renderPricingMarkdown(locale: Locale): Promise<string> {
  const meta = await getTranslations({ locale, namespace: 'metadata.pricing' });
  const t = await getTranslations({ locale, namespace: 'landing' });
  return [
    `# ${t('pricing.title')}`,
    '',
    `> ${meta('description')}`,
    '',
    ...(await pricingLines(locale)),
    '',
    link(t('header.getStarted'), pageUrl(locale, '')),
    '',
  ].join('\n');
}
