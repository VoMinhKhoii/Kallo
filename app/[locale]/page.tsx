import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { OAuthErrorToast } from '@/components/auth/oauth-error-toast';
import {
  Footer,
  Header,
  MealCardHero,
  PricingSection,
  TextFirstSection,
} from '@/components/landing-page';
import { WaitlistStatusToast } from '@/components/landing-page/waitlist/waitlist-status-toast';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; next?: string }>;
}) {
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

  return (
    <AuthProvider next={next} initialOpen={initialOpen} initialTab={initialTab}>
      <Header />
      <main>
        <MealCardHero />
        <TextFirstSection />
        <PricingSection />
      </main>
      <Footer />
      <AuthDialog />
      <Suspense fallback={null}>
        <OAuthErrorToast />
        <WaitlistStatusToast />
      </Suspense>
    </AuthProvider>
  );
}
