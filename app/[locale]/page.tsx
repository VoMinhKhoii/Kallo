import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { OAuthErrorToast } from '@/components/auth/oauth-error-toast';
import {
  CTASection,
  Footer,
  Header,
  Hero,
  ProblemSection,
  SolutionSection,
} from '@/components/landing-page';
import { safeNextPath } from '@/lib/auth/safe-next';

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

  return (
    <AuthProvider next={next} initialOpen={initialOpen} initialTab={initialTab}>
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <CTASection />
      </main>
      <Footer />
      <AuthDialog />
      <Suspense fallback={null}>
        <OAuthErrorToast />
      </Suspense>
    </AuthProvider>
  );
}
