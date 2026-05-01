import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import {
  parseSidebarExpandMode,
  parseSidebarState,
  SIDEBAR_EXPAND_MODE_COOKIE,
  SIDEBAR_STATE_COOKIE,
} from '@/lib/sidebar/cookies';
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

  const displayName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null;

  // Read sidebar UI prefs from cookies so the first paint matches the user's
  // saved state (no flash, no hydration mismatch). Falls back to sensible
  // defaults: open + click mode.
  const cookieStore = await cookies();
  const initialSidebarState =
    parseSidebarState(cookieStore.get(SIDEBAR_STATE_COOKIE)?.value) ?? 'open';
  const initialSidebarExpandMode =
    parseSidebarExpandMode(
      cookieStore.get(SIDEBAR_EXPAND_MODE_COOKIE)?.value
    ) ?? 'click';

  return (
    <AppShell
      onboardingStep={onboardingStep}
      initialProfile={profile}
      isFirstSession={isFirstSession}
      user={{ email: user.email ?? null, displayName }}
      initialSidebarState={initialSidebarState}
      initialSidebarExpandMode={initialSidebarExpandMode}
    >
      {children}
    </AppShell>
  );
}
