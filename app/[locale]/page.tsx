import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { OAuthErrorToast } from '@/components/auth/oauth-error-toast';
import { DocsFooter } from '@/components/docs/docs-footer';
import {
  AmbientWash,
  Header,
  MealCardHero,
  PricingSection,
  UnderstandingSection,
} from '@/components/landing-page';
import { WaitlistStatusToast } from '@/components/landing-page/waitlist/waitlist-status-toast';
import type { Locale } from '@/i18n/config';
import { safeNextPath } from '@/lib/auth/safe-next';
import { getDocsTree } from '@/lib/docs/tree';
import { createClient } from '@/lib/supabase/server';

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

  return (
    <AuthProvider next={next} initialOpen={initialOpen} initialTab={initialTab}>
      {/* One fixed layer behind everything, so the drift runs the whole way
          down instead of stopping where the hero ends. */}
      <AmbientWash />
      <Header />
      <main>
        <MealCardHero />
        <UnderstandingSection />
        <PricingSection />
      </main>
      <DocsFooter sections={sections} />
      <AuthDialog />
      <Suspense fallback={null}>
        <OAuthErrorToast />
        <WaitlistStatusToast />
      </Suspense>
    </AuthProvider>
  );
}
