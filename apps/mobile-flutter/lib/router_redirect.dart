/// The app's redirect rule, as a pure function over the state the router reads
/// — so it can be tested without a Supabase client, a container, or pumping the
/// destination screens.
library;

import 'features/onboarding/data/onboarding_draft.dart';

/// The routes a signed-OUT user may sit on: the pre-auth flow (start → wizard →
/// save your plan) plus the two auth screens. `/circle/invite/*` is reachable
/// too but is a pattern, not a member — the connect screen renders the "sign in
/// to connect" state itself.
///
/// The same set is what a signed-IN user is bounced OFF: the pre-auth flow is
/// not a place an account can sit.
const Set<String> _preAuthRoutes = {
  '/sign-in',
  '/sign-up',
  '/start',
  '/onboarding',
  '/save-plan',
};

/// Where the router should send a user standing at [location], or `null` to
/// leave them there.
///
/// Mobile diverges from the web auth gate in `middleware.ts` from Phase C2 on,
/// because onboarding runs BEFORE sign-in. The rules, in order:
///
///   1. session loading → stay on `/` (the splash).
///   2. signed OUT: allow [_preAuthRoutes] and `/circle/invite/*`. Otherwise
///      the local draft decides — finished the wizard → `/save-plan`, started
///      it → `/onboarding`, else `/start`; while it is still coming off disk,
///      stay on `/`.
///   3. signed IN with a non-empty local draft → `/welcome`, which flushes the
///      draft onto the server before the setup interstitial runs.
///   4. signed IN, no draft: `/welcome` always passes, brand-new first-session
///      users are held on the splash until the profile resolves and are then
///      forced into `/onboarding`, everyone else is bounced off the pre-auth
///      routes into the app (or into a pending invite).
///
/// [draft] and [onboarding] group the values that only ever travel together.
String? resolveRedirect({
  required String location,
  required bool sessionLoading,
  required bool signedIn,
  required ({bool loading, OnboardingDraft? value}) draft,
  required bool firstSession,
  required bool dismissed,
  required ({bool force, bool loading}) onboarding,
  required String? pendingInvite,
}) {
  final loc = location;

  // Hold the splash rather than flashing the sign-in screen — mirrors RN's
  // `loading` ActivityIndicator gate.
  if (sessionLoading) return loc == '/' ? null : '/';

  if (!signedIn) {
    if (_preAuthRoutes.contains(loc) || loc.startsWith('/circle/invite/')) {
      return null;
    }
    // Hold the splash until the draft is off disk rather than flashing
    // `/start` at someone who is three screens into the wizard.
    if (draft.loading) return loc == '/' ? null : '/';
    final value = draft.value;
    if (value == null || value.isEmpty) return '/start';
    // `hasFinishedScreens`, NOT `isComplete`: the body metrics are optional,
    // and without them step 2 never gets a payload — that user answered every
    // screen and must reach `/save-plan` rather than loop on the wizard.
    return value.hasFinishedScreens ? '/save-plan' : '/onboarding';
  }

  // The post-finish setup interstitial flushes the draft and warms caches, so
  // it is always reachable — even mid completion when the profile is stale.
  if (loc == '/welcome') return null;

  // Signed in with answers still on disk: the wizard ran signed OUT and
  // nothing has posted them yet. Read WITHOUT the loading hold above — a
  // signed-in user with no draft (every existing user) must not wait on secure
  // storage to reach the app.
  final pending = draft.value;
  if (pending != null && !pending.isEmpty) return '/welcome';

  // Brand-new first-session users: hold on the splash until the profile (the
  // onboarding decision) resolves, so they don't flash the dashboard first.
  if (firstSession && !dismissed && onboarding.loading) {
    return loc == '/' ? null : '/';
  }

  // Force ONLY brand-new first-session users with an incomplete profile into
  // the full-page wizard. Returning-incomplete users resume via the sidebar
  // dialog; closing/finishing sets `dismissed` so the router stops re-forcing.
  if (firstSession && !dismissed && onboarding.force) {
    return loc == '/onboarding' ? null : '/onboarding';
  }

  // Bounce away from the index / auth / pre-auth routes into the app; leave
  // in-app tab routes alone.
  if (loc == '/' || _preAuthRoutes.contains(loc)) {
    // A pending invite (stashed when a signed-out user opened an invite link)
    // wins over the dashboard, so it survives the sign-in detour.
    if (pendingInvite != null) return '/circle/invite/$pendingInvite';
    return '/dashboard';
  }
  return null;
}
