import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { link, pageUrl } from './blocks';

/**
 * The plans as Markdown: a section of the landing page's Markdown, and the
 * whole of `/pricing`'s, which renders the same `PricingSection`. Built from
 * the `landing.pricing` messages; the per-plan feature lists live in component
 * code, so they are linked (the docs' plan comparison), not copied.
 */
export async function pricingLines(locale: Locale): Promise<string[]> {
  const t = await getTranslations({ locale, namespace: 'landing.pricing' });
  const premium = pageUrl(locale, '/docs/account/premium');
  return [
    `- **${t('plans.free.name')}** (${t('plans.free.price')}) — ${t('plans.free.tagline')}. ${t('plans.free.fineprint')}`,
    `- **${t('plans.premium.name')}** (${t('plans.premium.priceMonthly')}/mo, or ${t('plans.premium.priceYearly')}/mo billed yearly) — ${t('plans.premium.tagline')}. ${t(
      'plans.premium.fineprintYearlyNoIntro',
      { price: t('plans.premium.billedYearly') }
    )}`,
    `- **${t('plans.lifetime.name')}** (${t('plans.lifetime.price')}) — ${t('plans.lifetime.tagline')}. ${t('plans.lifetime.fineprint')}`,
    '',
    t('offerNote'),
    '',
    `Full plan comparison: ${link(premium, premium)}`,
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
