import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app/shell/app-shell';
import { AppShellSkeleton } from '@/components/app/shell/app-shell-skeleton';
import { EntitlementLifecycleSync } from '@/components/billing/activation/entitlement-lifecycle-sync';
import { PremiumGuardProvider } from '@/components/billing/premium-guard-provider';
import { AiConsentProvider } from '@/components/privacy/ai-consent-provider';
import { getMyPublicProfile } from '@/lib/actions/groups/profile';
import { isAdminEmail } from '@/lib/admin/authz/is-admin';
import { getBillingConfig } from '@/lib/domain/billing/billing';
import { getOnboardingProfile } from '@/lib/domain/onboarding/actions';
import { createClient } from '@/lib/infra/supabase/server';
import {
  parseSidebarExpandMode,
  parseSidebarState,
  SIDEBAR_EXPAND_MODE_COOKIE,
  SIDEBAR_STATE_COOKIE,
} from '@/lib/sidebar/cookies';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Every authenticated route renders inside this layout, and everything it
 * shows depends on the session. Under Cache Components a session read cannot
 * be part of the prerendered static shell, so it lives behind a `<Suspense>`
 * boundary: a direct visit paints `AppShellSkeleton` from static HTML at once
 * and the real shell + page stream in. Client navigations between app routes
 * never re-render this layout; each page's `loading.tsx` (or its own boundary)
 * is what shows while that page's data streams.
 *
 * Side effect of streaming: a signed-out visitor now gets the static skeleton
 * followed by a client-side redirect to `/`, where it used to be an HTTP 307.
 * Nothing user-specific is in the skeleton, so nothing leaks.
 */
export default function AppLayout({ children }: Readonly<AppLayoutProps>) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <SessionAppShell>{children}</SessionAppShell>
    </Suspense>
  );
}

async function SessionAppShell({ children }: Readonly<AppLayoutProps>) {
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
  // Read the kill-switch here rather than letting the client discover it from
  // an entitlements fetch: with enforcement off the guard provider skips that
  // request and never pulls the paywall chunk. Deliberately uncaught — a
  // misconfigured launch date must fail loudly, not quietly gate nothing.
  const { enforcementEnabled } = getBillingConfig();

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
      <PremiumGuardProvider
        userId={user.id}
        enforcementEnabled={enforcementEnabled}
      >
        <AiConsentProvider
          initialConsented={Boolean(profile?.aiProcessingConsentedAt)}
        >
          {children}
        </AiConsentProvider>
      </PremiumGuardProvider>
    </AppShell>
  );
}
