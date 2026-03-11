import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const profile = await getOnboardingProfile();
  const onboardingStep = profile?.onboardingStep ?? 0;

  return (
    <AppShell onboardingStep={onboardingStep} initialProfile={profile}>
      {children}
    </AppShell>
  );
}
