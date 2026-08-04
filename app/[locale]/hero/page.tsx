import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { HeroLabSwitcher } from '@/components/hero-lab/hero-lab-switcher';
import { Footer } from '@/components/landing-page/footer';

export const metadata: Metadata = {
  title: 'Kallo — hero lab',
  robots: { index: false },
};

/**
 * The hero lab: "You describe, we derive." over the app's own meal cards, on
 * cream or espresso. Unlisted and noindexed, like /v3 and /design-system.
 *
 * The real Footer is rendered here, on the server, and handed to the client
 * shell as a prop — it reads its own translations and has no business being
 * re-implemented for a lab surface.
 */
export default async function HeroLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HeroLabSwitcher footer={<Footer />} />;
}
