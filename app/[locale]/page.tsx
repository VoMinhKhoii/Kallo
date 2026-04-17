'use client';

import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
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
    </AuthProvider>
  );
}
