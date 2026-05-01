import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { isAdminEmail } from '@/lib/admin/is-admin';
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

  // Detect first session: last_sign_in_at ≈ created_at (within 1 minute)
  const createdMs = new Date(user.created_at).getTime();
  const signInMs = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).getTime()
    : createdMs;
  const isFirstSession = Math.abs(signInMs - createdMs) < 60_000;

  let profile = null;
  try {
    profile = await getOnboardingProfile();
  } catch (error) {
    console.error('Failed to load onboarding profile:', error);
  }
  const onboardingStep = profile?.onboardingStep ?? 0;
  const isAdmin = isAdminEmail(user.email);
  const userEmail = user.email ?? null;
  const userDisplayName = userEmail?.split('@')[0] ?? null;

  return (
    <AppShell
      onboardingStep={onboardingStep}
      initialProfile={profile}
      isFirstSession={isFirstSession}
      isAdmin={isAdmin}
      userEmail={userEmail}
      userDisplayName={userDisplayName}
    >
      {children}
    </AppShell>
  );
}
