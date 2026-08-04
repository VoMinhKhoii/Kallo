import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DocsFooter } from '@/components/docs/docs-footer';
import { HeroLabSwitcher } from '@/components/hero-lab/hero-lab-switcher';
import type { Locale } from '@/i18n/config';
import { getDocsTree } from '@/lib/docs/tree';

export const metadata: Metadata = {
  title: 'Kallo — hero lab',
  robots: { index: false },
};

/**
 * The hero lab: "You describe, we derive." over the app's own meal cards, on
 * cream or espresso. Unlisted and noindexed, like /v3 and /design-system.
 *
 * The footer is the docs one: it is already an espresso band, so it ends the
 * page on either ground instead of dropping a cream slab under a dark hero.
 * Rendered here on the server and handed to the client shell as a prop.
 */
export default async function HeroLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sections = await getDocsTree(locale as Locale);

  return <HeroLabSwitcher footer={<DocsFooter sections={sections} />} />;
}
