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

export default function Home() {
  return (
    <AuthProvider>
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
