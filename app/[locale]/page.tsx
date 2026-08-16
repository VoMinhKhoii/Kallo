import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { OAuthErrorToast } from '@/components/auth/oauth-error-toast';
import { DocsFooter } from '@/components/docs/docs-footer';
import { AmbientWash } from '@/components/landing-page/ambient-wash';
import { Header } from '@/components/landing-page/header';
import { MealCardHero } from '@/components/landing-page/hero/meal-card-hero';
import { PricingSection } from '@/components/landing-page/pricing/pricing-section';
import { UnderstandingSection } from '@/components/landing-page/understanding/understanding-section';
import { WaitlistStatusToast } from '@/components/landing-page/waitlist/waitlist-status-toast';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/navigation';
import { googleWebClientId } from '@/lib/auth/google-client-id';
import { safeNextPath } from '@/lib/auth/safe-next';
import { getDocsTree } from '@/lib/docs/tree';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { landingStructuredData } from '@/lib/seo/structured-data';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

/**
 * The locale layout sets title/description/OG but deliberately no shared
 * canonical, so the landing page — the one page of the site that actually gets
 * linked and shared — has to declare its own. Without it, `?auth=…`,
 * `?next=…` and every campaign parameter is a separate indexable URL.
 *
 * The docs route already does this per page; this is the same treatment for
 * the marketing root. `x-default` points at `en` because that is
 * `defaultLocale`, i.e. what `/` resolves to for a visitor with no cookie and
 * no matching language — which is every crawler.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  return {
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        vi: `${SITE_URL}/vi`,
        'x-default': `${SITE_URL}/en`,
      },
    },
    // Spread, not `{ url }` alone: declaring `openGraph` replaces the layout's
    // object, so setting only the url drops the preview image and site name.
    openGraph: { ...SHARED_OPEN_GRAPH, url: `${SITE_URL}/${locale}`, locale },
  };
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ auth?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { auth, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  // Open the auth dialog when arriving from an invite link (?auth=…&next=…).
  // Default to the sign-up tab, since invite recipients usually have no account.
  const initialOpen = auth === 'sign-in' || auth === 'sign-up' || next !== null;
  const initialTab = auth === 'sign-in' ? 'sign-in' : 'sign-up';

  // A signed-in visitor with no auth/invite intent shouldn't see the marketing
  // page — send them into the app. This is also what makes the installed PWA
  // (whose start_url is /dashboard) never flash the landing page.
  if (!initialOpen) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect('/dashboard');
    }
  }

  // The docs footer, not a marketing one: it is already the full site directory
  // (including Legal), and its espresso ground is what ends the page — a cream
  // footer under a cream page needs a rule and still reads as more page.
  const sections = await getDocsTree(locale as Locale);

  const t = await getTranslations({ locale, namespace: 'metadata.root' });
  const structuredData = landingStructuredData({
    locale,
    name: t('title'),
    description: t('description'),
  });

  return (
    <AuthProvider
      next={next}
      googleClientId={googleWebClientId()}
      initialOpen={initialOpen}
      initialTab={initialTab}
    >
      {/* JSON-LD must be raw script text, and Next has no metadata API for it,
          so a script tag is the documented route. The value is a locally-built
          object passed through JSON.stringify — never user input. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is raw script text built locally, not user input — see comment above.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* One fixed layer behind everything, so the drift runs the whole way
          down instead of stopping where the hero ends. */}
      <AmbientWash />
      <Header />
      <main>
        <MealCardHero />
        <UnderstandingSection />
        <PricingSection />
      </main>
      <DocsFooter landing sections={sections} />
      <AuthDialog />
      <Suspense fallback={null}>
        <OAuthErrorToast />
        <WaitlistStatusToast />
      </Suspense>
    </AuthProvider>
  );
}
