import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { HeroLabSwitcher } from '@/components/hero-lab/hero-lab-switcher';

export const metadata: Metadata = {
  title: 'Kallo — hero lab',
  robots: { index: false },
};

/**
 * The hero lab: every direction on one page, swapped in place by the switch at
 * the bottom. One headline — "You describe, we derive." — two compositions,
 * two grounds. Unlisted and noindexed, like /v3 and /design-system.
 */
export default async function HeroLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HeroLabSwitcher />;
}
