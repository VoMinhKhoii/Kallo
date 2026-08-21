import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { PricingSection } from '@/components/landing-page/pricing/pricing-section';
import { routing } from '@/i18n/navigation';
import { googleWebClientId } from '@/lib/infra/auth/google-client-id';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Pricing, on its own URL.
 *
 * The plans already live in `PricingSection`, rendered as a band near the
 * bottom of the landing page. This route renders that same component and
 * nothing else, so a price, a plan or a feature line is edited in exactly one
 * place and both surfaces move together — a second copy of the cards here
 * would drift the first time a tier changes.
 *
 * No header and no footer: this is the sharable "what does it cost" link, and
 * the section is the whole answer. It carries its own beige ground, so the
 * wrapper only has to extend that ground to the full viewport when the cards
 * do not fill it.
 *
 * `AuthProvider` is here because each card's CTA opens the auth dialog. The
 * landing page mounts its own; the two never coexist, since this page is not
 * part of it.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: 'metadata.pricing' });
  const url = `${SITE_URL}/${locale}/pricing`;

  return {
    title: t('title'),
    description: t('description'),
    // The locale layout sets no shared canonical, so every page declares its
    // own or inherits the locale root as one.
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE_URL}/en/pricing`,
        vi: `${SITE_URL}/vi/pricing`,
        'x-default': `${SITE_URL}/${routing.defaultLocale}/pricing`,
      },
    },
    // Spread, not a bare object: declaring `openGraph` replaces the layout's
    // wholesale, and setting only the url would drop the preview image.
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: t('title'),
      description: t('description'),
      locale,
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthProvider googleClientId={googleWebClientId()}>
      <main className="flex min-h-dvh flex-col justify-center bg-kallo-hover">
        <PricingSection />
      </main>
      <AuthDialog />
    </AuthProvider>
  );
}
