import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'services/auth/session_provider.dart';
import 'features/auth/screens/email_auth_screen.dart';
import 'features/auth/screens/sign_in_screen.dart';
import 'features/auth/screens/sign_up_screen.dart';
import 'features/circle/data/circle_providers.dart';
import 'features/circle/screens/circle_screen.dart';
import 'features/circle/screens/circle_thread_screen.dart';
import 'features/circle/screens/connect_screen.dart';
import 'features/dashboard/screens/dashboard_screen.dart';
import 'features/logging/screens/logging_screen.dart';
import 'features/nutrition/screens/nutrition_screen.dart';
import 'features/onboarding/providers/onboarding_draft_providers.dart';
import 'features/onboarding/providers/onboarding_providers.dart';
import 'features/onboarding/screens/onboarding_screen.dart';
import 'features/onboarding/screens/save_plan_screen.dart';
import 'features/onboarding/screens/start_screen.dart';
import 'features/onboarding/screens/welcome_setup_screen.dart';
import 'features/paywall/screens/paywall_screen.dart';
import 'features/settings/screens/settings_screen.dart';
import 'router_redirect.dart';
import 'shell/nav/router_refresh.dart';
import 'shell/placeholder_screen.dart';
import 'shell/route_error_screen.dart';
import 'shell/splash_screen.dart';
import 'shell/tab_scaffold.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// The app's [GoRouter], wired to Riverpod for the auth redirect.
///
/// Routing model (native pass, 2026-08-31):
///   • A [StatefulShellRoute] hosts the pill-nav destinations (`/dashboard`,
///     `/nutrition`, `/circle`) plus the off-bar `/admin`. Each is its own
///     branch so state/scroll persist across tab switches.
///   • `/logging` is a ROOT route pushed full-screen over the shell (the
///     pill nav's Log item; swipe-back returns to the tab the user came from —
///     feed state lives in providers, so nothing is lost).
///   • `/start`, `/sign-in` (+ `/sign-in/email`), `/sign-up`, `/onboarding`,
///     `/save-plan` (+ `/save-plan/email`),
///     `/welcome` and `/settings` are standalone root routes (`/settings`
///     pushes over the shell from the dashboard avatar).
///   • `/` redirects based on auth + onboarding state.
///
/// Pages are `MaterialPage`, NOT `CupertinoPage`: the app's transition and its
/// full-width back drag are installed once in `KalloTheme.light`'s
/// `pageTransitionsTheme` (`shell/nav/swipe_back/`), and a `CupertinoPage`
/// builds its own transition without ever consulting the theme. So a route
/// added here inherits the gesture by doing nothing.
///
/// The redirect diverges from the web auth gate in `middleware.ts` from Phase
/// C2 on: mobile runs onboarding BEFORE sign-in, so a signed-out user is not
/// bounced to `/sign-in` but to wherever their LOCAL DRAFT says they are. The
/// rules are quoted, in order, on [resolveRedirect] — one copy, in the file
/// that applies them; [_redirect] below is only the Riverpod plumbing.
///
/// It re-evaluates on every auth state change via [refreshListenable] (an
/// auth-stream bridge), matching RN's `onAuthStateChange` re-render, and on
/// the async provider settles it listens to below. Every one of those
/// re-evaluations is DEFERRED by [RouterRefresh] — [_redirect] reads seven
/// providers and go_router runs it synchronously, which is unsafe from
/// inside a Riverpod notification. That file carries the whole rule.
final routerProvider = Provider<GoRouter>((ref) {
  // Re-run redirects whenever Supabase auth state changes.
  final refresh = RouterRefresh(ref.read(authEventsProvider));
  ref.onDispose(refresh.dispose);

  // Re-run redirects when the async profile resolves and flips the
  // onboarding-resume decision (signed-in + incomplete profile → /onboarding).
  // Auth changes alone don't cover this — the profile fetch settles later.
  // `profileProvider` itself covers the brand-new-user splash hold (we wait on
  // the profile before deciding); the dismissed flag covers skip-out.
  ref.listen(profileProvider, (_, __) => refresh.ping());
  ref.listen(onboardingResumeProvider, (_, __) => refresh.ping());
  ref.listen(onboardingForceDismissedProvider, (_, __) => refresh.ping());
  // The signed-out landing is decided by the local draft, which arrives from
  // secure storage a beat late — same shape as the profile above, same fix.
  ref.listen(onboardingDraftProvider, (_, __) => refresh.ping());

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    // `state.error` is always a GoException here, so the pose turns on what it
    // says: "no routes for location" is an address with no screen behind it; a
    // redirect loop or any other GoException is a route that failed. The two
    // say different things to the user.
    errorBuilder:
        (context, state) => RouteErrorScreen(
          notFound: RouteErrorScreen.isNotFound(state.error),
        ),
    redirect: (context, state) => _redirect(ref, state.matchedLocation),
    routes: [
      // Index — pure redirect target (resolved above). A bare splash so there's
      // a frame to render while the redirect computes.
      GoRoute(path: '/', builder: (context, state) => const SplashScreen()),

      // The signed-out entry: brand, a preview of the Log screen, and the two
      // ways in (start the wizard, or sign in to an existing account).
      GoRoute(
        path: '/start',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const StartScreen(),
      ),
      GoRoute(
        path: '/sign-in',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const SignInScreen(),
        routes: [
          // The email path, pushed from the welcome face's "Continue with
          // email". A child route so Back pops to the options that opened it.
          GoRoute(
            path: 'email',
            parentNavigatorKey: _rootKey,
            builder:
                (context, state) => const EmailAuthScreen(createAccount: false),
          ),
        ],
      ),
      GoRoute(
        path: '/sign-up',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const SignUpScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const OnboardingScreen(),
      ),
      // The last signed-out step: the auth surface under the wizard's chrome,
      // reached when the draft is complete.
      GoRoute(
        path: '/save-plan',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const SavePlanScreen(),
        routes: [
          // Same screen, opened on sign-UP: whoever just built a plan here has
          // no account yet. Back pops to `/save-plan`.
          GoRoute(
            path: 'email',
            parentNavigatorKey: _rootKey,
            builder:
                (context, state) => const EmailAuthScreen(createAccount: true),
          ),
        ],
      ),
      GoRoute(
        path: '/welcome',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const WelcomeSetupScreen(),
      ),
      // Invite-accept deep link (`nham://invite/<slug>` / https invite links).
      // Pushed over the shell so it overlays the app; reachable while signed
      // out (it renders the sign-in CTA itself).
      GoRoute(
        path: '/circle/invite/:slug',
        parentNavigatorKey: _rootKey,
        builder:
            (context, state) =>
                ConnectScreen(slug: state.pathParameters['slug'] ?? ''),
      ),
      // Settings pushes over the shell from the header avatar — it's an
      // account surface, not a primary tab destination.
      GoRoute(
        path: '/settings',
        parentNavigatorKey: _rootKey,
        pageBuilder:
            (context, state) =>
                const MaterialPage<void>(child: SettingsScreen()),
      ),
      // Paywall — pushed over the shell (from Settings, or when a gated action
      // hits an HTTP 402), like Settings. `?onboarding=1`
      // is the last step of the first run: both exits then continue INTO the
      // app instead of popping back to the setup interstitial.
      GoRoute(
        path: '/paywall',
        parentNavigatorKey: _rootKey,
        pageBuilder:
            (context, state) => MaterialPage<void>(
              child: PaywallScreen(
                onboarding: state.uri.queryParameters['onboarding'] == '1',
              ),
            ),
      ),
      // The logging feed — FULL-SCREEN over the shell (the pill nav's Log
      // item, and every "take me to logging" call site via goToLogging). The
      // composer owns this screen's bottom edge, which is why it is not a
      // shell branch under the floating bar.
      GoRoute(
        path: '/logging',
        parentNavigatorKey: _rootKey,
        pageBuilder:
            (context, state) =>
                const MaterialPage<void>(child: LoggingScreen()),
      ),

      // One Circle post and its replies, pushed over the shell from the feed's
      // reply glyph. `scope` names the feed the post was read from (absent =
      // the combined friends feed): the page prefers that feed's live cache
      // and falls back to fetching the single share, the two sources documented
      // in `features/circle/data/thread_providers.dart`. The scope stays in
      // the URL because the feed is the primary read.
      //
      // `:shareId` SHADOWS any literal `/circle/<word>` segment — go_router
      // takes the first match — so a future one must be declared BEFORE this
      // route, exactly as `/circle/invite/:slug` already is above.
      GoRoute(
        path: '/circle/:shareId',
        parentNavigatorKey: _rootKey,
        pageBuilder:
            (context, state) => MaterialPage<void>(
              child: CircleThreadScreen(
                shareId: state.pathParameters['shareId'] ?? '',
                scope: state.uri.queryParameters['scope'],
                autofocusComposer: state.uri.queryParameters['compose'] == '1',
              ),
            ),
      ),

      // The pill-nav destinations — each its own branch so state/scroll
      // persist across tab switches. Order matches the bar: dashboard,
      // nutrition, circle; admin stays off-bar (reachable by route only).
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootKey,
        builder:
            (context, state, navigationShell) =>
                TabScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _shellKey,
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/nutrition',
                builder: (context, state) => const NutritionScreen(),
              ),
            ],
          ),
          // Circle (the social surface, formerly "Groups"). Admin remains a
          // placeholder until its Flutter screen is ported.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/circle',
                builder: (context, state) => const CircleScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin',
                builder:
                    (context, state) => const PlaceholderScreen(
                      titleKey: 'app.mainSidebar.admin',
                    ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

/// Gathers what [resolveRedirect] needs out of Riverpod. The rule itself is in
/// `router_redirect.dart` — plain values in, a location out — so it can be
/// tested without a Supabase client or a single pumped screen.
String? _redirect(Ref ref, String location) {
  final sessionAsync = ref.read(sessionProvider);
  // The AUTHORITATIVE session, straight off the client: the listenable and the
  // provider both subscribe to `onAuthStateChange`, so on sign-out the redirect
  // can run before the provider's stream has propagated the null and strand the
  // user in the app. `auth.currentSession` is updated synchronously.
  final session = ref.read(currentSessionReaderProvider)();
  final draftAsync = ref.read(onboardingDraftProvider);
  final profileAsync = ref.read(profileProvider);

  return resolveRedirect(
    location: location,
    sessionLoading: !_settled(sessionAsync),
    signedIn: session != null,
    draft: (loading: !_settled(draftAsync), value: draftAsync.valueOrNull),
    firstSession: _isFirstSession(session?.user),
    dismissed: ref.read(onboardingForceDismissedProvider),
    onboarding: (
      force: ref.read(onboardingResumeProvider),
      loading: !_settled(profileAsync),
    ),
    pendingInvite: ref.read(pendingInviteSlugProvider),
  );
}

/// Whether an async source has an answer the redirect may act on. A REFRESH is
/// not a wait — every save invalidates the profile — so the hold is `isLoading`
/// AND nothing to show.
bool _settled(AsyncValue<Object?> async) => !async.isLoading || async.hasValue;

/// Whether this looks like the user's very first session — a brand-new account
/// whose last sign-in is within 60s of creation. Mirrors the web layout's
/// `isFirstSession` gate (`app/[locale]/(app)/layout.tsx`) so only fresh
/// sign-ups are force-routed into onboarding.
bool _isFirstSession(User? user) {
  if (user == null) return false;
  final created = DateTime.tryParse(user.createdAt);
  if (created == null) return false;
  final lastRaw = user.lastSignInAt;
  final lastSignIn = lastRaw != null ? DateTime.tryParse(lastRaw) : null;
  final signIn = lastSignIn ?? created;
  return signIn.difference(created).abs() < const Duration(seconds: 60);
}
