import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/session_provider.dart';
import 'features/auth/screens/sign_in_screen.dart';
import 'features/auth/screens/sign_up_screen.dart';
import 'features/dashboard/screens/dashboard_screen.dart';
import 'features/logging/screens/logging_screen.dart';
import 'features/nutrition/screens/nutrition_screen.dart';
import 'features/onboarding/providers/onboarding_providers.dart';
import 'features/onboarding/screens/onboarding_screen.dart';
import 'features/settings/screens/settings_screen.dart';
import 'services/supabase_service.dart';
import 'shell/placeholder_screen.dart';
import 'shell/tab_scaffold.dart';
import 'theme/nham_colors.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// The app's [GoRouter], wired to Riverpod for the auth redirect.
///
/// Routing model (per the port contract):
///   • A [StatefulShellRoute] hosts the primary destinations behind the shell's
///     left nav drawer (`/dashboard`, `/nutrition`, `/logging`, `/groups`,
///     `/admin`) plus `/settings` (drawer footer). Each is its own branch so
///     state/scroll persist across drawer navigations.
///   • `/sign-in`, `/sign-up`, and `/onboarding` are standalone root routes.
///   • `/` redirects based on auth + onboarding state.
///
/// The redirect mirrors the RN gates (`app/index.tsx` +
/// `app/(app)/_layout.tsx`): signed-out → `/sign-in`; signed-in but onboarding
/// incomplete → `/onboarding`; otherwise → `/dashboard`. It re-evaluates on
/// every auth state change via [refreshListenable] (an auth-stream bridge),
/// matching RN's `onAuthStateChange` re-render.
final routerProvider = Provider<GoRouter>((ref) {
  // Re-run redirects whenever Supabase auth state changes.
  final refresh = _GoRouterAuthRefresh(SupabaseService.client.auth);
  ref.onDispose(refresh.dispose);

  // Re-run redirects when the async profile resolves and flips the
  // onboarding-resume decision (signed-in + incomplete profile → /onboarding).
  // Auth changes alone don't cover this — the profile fetch settles later.
  ref.listen(onboardingResumeProvider, (_, __) => refresh.ping());

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      // While the very first session restore is in flight, hold on `/` (the
      // splash) rather than flashing the sign-in screen — mirrors RN's
      // `loading` ActivityIndicator gate.
      final sessionAsync = ref.read(sessionProvider);
      if (sessionAsync.isLoading && !sessionAsync.hasValue) {
        return state.matchedLocation == '/' ? null : '/';
      }

      // Read the AUTHORITATIVE session straight off the client, not the
      // `sessionProvider` AsyncValue. The refresh listenable and the provider
      // both subscribe to `onAuthStateChange`; on sign-out the redirect can run
      // (driven by the listenable) before the provider's stream has propagated
      // the null, leaving a stale signed-in value and stranding the user in the
      // app. `auth.currentSession` is updated synchronously before the event
      // fires, so it's always current here.
      final signedIn = SupabaseService.client.auth.currentSession != null;
      // RN's index never force-routed to onboarding — the wizard is a
      // DISMISSIBLE overlay over the dashboard (OnboardingGate). So signed-in
      // users land on the app; onboarding is reachable at /onboarding but not
      // forced. (Set this to `!ref.read(onboardingResumeProvider)` to force
      // incomplete profiles into the wizard instead.)
      const onboardingComplete = true;
      final loc = state.matchedLocation;

      final atAuth = loc == '/sign-in' || loc == '/sign-up';
      final atOnboarding = loc == '/onboarding';

      // Signed out: only the auth routes are reachable.
      if (!signedIn) {
        return atAuth ? null : '/sign-in';
      }

      // Signed in but onboarding unfinished → the wizard, unless already there.
      if (!onboardingComplete) {
        return atOnboarding ? null : '/onboarding';
      }

      // Fully onboarded: bounce away from the index / auth / onboarding routes
      // into the app; leave in-app tab routes untouched.
      if (loc == '/' || atAuth || atOnboarding) {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      // Index — pure redirect target (resolved above). A bare splash so there's
      // a frame to render while the redirect computes.
      GoRoute(path: '/', builder: (context, state) => const _SplashScreen()),

      GoRoute(
        path: '/sign-in',
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const SignInScreen(),
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

      // The primary destinations — each its own branch so state/scroll persist
      // across drawer navigations. Order mirrors the web nav list (dashboard,
      // nutrition, logging, groups, admin) plus settings (drawer footer).
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
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/logging',
                builder: (context, state) => const LoggingScreen(),
              ),
            ],
          ),
          // Groups + Admin exist as web nav destinations but their Flutter
          // feature screens aren't ported yet; route to a shell placeholder so
          // the drawer nav model stays faithful without inventing feature UI.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                builder:
                    (context, state) => const PlaceholderScreen(
                      titleKey: 'app.mainSidebar.groups',
                    ),
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
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

/// Bridges Supabase's auth stream to a [Listenable] for [GoRouter.refreshListenable].
///
/// Re-runs the router's redirect on every auth state change (sign-in,
/// sign-out, token refresh) — the go_router equivalent of RN's
/// `onAuthStateChange` re-render.
class _GoRouterAuthRefresh extends ChangeNotifier {
  _GoRouterAuthRefresh(GoTrueClient auth) {
    notifyListeners();
    _sub = auth.onAuthStateChange.listen((_) => notifyListeners());
  }

  late final StreamSubscription<AuthState> _sub;

  /// Lets external Riverpod listeners (e.g. the onboarding-resume decision)
  /// trigger a redirect re-evaluation.
  void ping() => notifyListeners();

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

/// Minimal cream splash shown on the index route while the redirect resolves.
/// Mirrors RN's centered [ActivityIndicator] on the surface background.
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: NhamColors.surface,
      child: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(NhamColors.accent),
          ),
        ),
      ),
    );
  }
}
