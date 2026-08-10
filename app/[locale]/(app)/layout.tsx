import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/shell/app-shell';
import { EntitlementLifecycleSync } from '@/components/billing/entitlement-lifecycle-sync';
import { getMyPublicProfile } from '@/lib/actions/groups/profile';
import { isAdminEmail } from '@/lib/admin/is-admin';
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
  const isAdmin = isAdminEmail(user.email);

  // The editable profile ("what should we call you" + avatar) is the source of
  // truth for identity; OAuth metadata is only the pre-rename fallback.
  let publicProfile = null;
  try {
    publicProfile = await getMyPublicProfile(user.id);
  } catch (error) {
    console.error('Failed to load public profile:', error);
  }

  const metadataName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null;
  const displayName = publicProfile?.displayName ?? metadataName;

  // Effective avatar: uploaded photo / synced OAuth picture from the profile
  // row, else the raw OAuth metadata picture (pre-provision fallback).
  const avatarSource =
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const avatarUrl =
    publicProfile?.avatarUrl ??
    (typeof avatarSource === 'string' && avatarSource.length > 0
      ? avatarSource
      : null);

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
      isAdmin={isAdmin}
      user={{ email: user.email ?? null, displayName, avatarUrl }}
      initialSidebarState={initialSidebarState}
      initialSidebarExpandMode={initialSidebarExpandMode}
    >
      <EntitlementLifecycleSync userId={user.id} />
      {children}
    </AppShell>
  );
}
