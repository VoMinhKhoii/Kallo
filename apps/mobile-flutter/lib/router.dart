import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/session_provider.dart';
import 'features/auth/screens/sign_in_screen.dart';
import 'features/auth/screens/sign_up_screen.dart';
import 'features/circle/data/circle_providers.dart';
import 'features/circle/screens/circle_screen.dart';
import 'features/circle/screens/connect_screen.dart';
import 'features/dashboard/screens/dashboard_screen.dart';
import 'features/logging/screens/logging_screen.dart';
import 'features/nutrition/screens/nutrition_screen.dart';
import 'features/onboarding/providers/onboarding_providers.dart';
import 'features/onboarding/screens/onboarding_screen.dart';
import 'features/onboarding/screens/welcome_setup_screen.dart';
import 'features/settings/screens/settings_screen.dart';
import 'services/supabase_service.dart';
import 'shell/placeholder_screen.dart';
import 'shell/tab_scaffold.dart';
import 'theme/nham_colors.dart';
import 'theme/nham_typography.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// The app's [GoRouter], wired to Riverpod for the auth redirect.
///
/// Routing model (per the port contract):
///   • A [StatefulShellRoute] hosts the primary destinations behind the bottom
///     tab bar (`/dashboard`, `/nutrition`, `/logging`) plus the off-bar
///     `/circle` and `/admin`. Each is its own branch so state/scroll persist
///     across tab switches.
///   • `/sign-in`, `/sign-up`, `/onboarding`, `/welcome`, and `/settings` are
///     standalone root routes (`/settings` pushes over the shell from the
///     header avatar with Cupertino swipe-back).
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
  // `profileProvider` itself covers the brand-new-user splash hold (we wait on
  // the profile before deciding); the dismissed flag covers skip-out.
  ref.listen(profileProvider, (_, __) => refresh.ping());
  ref.listen(onboardingResumeProvider, (_, __) => refresh.ping());
  ref.listen(onboardingForceDismissedProvider, (_, __) => refresh.ping());

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
      final session = SupabaseService.client.auth.currentSession;
      final signedIn = session != null;
      final loc = state.matchedLocation;

      final atAuth = loc == '/sign-in' || loc == '/sign-up';
      final atOnboarding = loc == '/onboarding';
      final atWelcome = loc == '/welcome';

      // Signed out: only the auth routes — and the invite connect screen —
      // are reachable. The connect screen renders the "sign in to connect"
      // state itself (and stashes the slug), so it must NOT bounce to sign-in.
      if (!signedIn) {
        if (atAuth || loc.startsWith('/circle/invite/')) return null;
        return '/sign-in';
      }

      // The post-finish setup interstitial is always reachable while signed in
      // (it warms caches then routes to /logging) — never bounce it, even mid
      // completion when the profile is briefly stale.
      if (atWelcome) return null;

      final firstSession = _isFirstSession(session.user);
      final dismissed = ref.read(onboardingForceDismissedProvider);

      // Brand-new first-session users: hold on the splash until the profile (the
      // onboarding decision) resolves, so they don't flash the dashboard first.
      if (firstSession && !dismissed) {
        final profileAsync = ref.read(profileProvider);
        if (profileAsync.isLoading && !profileAsync.hasValue) {
          return loc == '/' ? null : '/';
        }
      }

      // Force ONLY brand-new first-session users with an incomplete profile into
      // the full-page wizard. Returning-incomplete users are NOT forced — they
      // resume via the sidebar dialog. Closing/finishing sets the session-scoped
      // dismissed flag so the router stops re-forcing them.
      final forceOnboarding =
          firstSession && !dismissed && ref.read(onboardingResumeProvider);
      if (forceOnboarding) {
        return atOnboarding ? null : '/onboarding';
      }

      // Not forced: bounce away from the index / auth / onboarding routes into
      // the app; leave in-app tab routes (and /welcome, handled above) alone.
      if (loc == '/' || atAuth || atOnboarding) {
        // A pending invite (stashed when a signed-out user opened an invite
        // link) wins over the dashboard, so the invite survives the sign-in
        // detour. The connect screen clears it on mount.
        final pending = ref.read(pendingInviteSlugProvider);
        if (pending != null) return '/circle/invite/$pending';
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
        builder: (context, state) =>
            ConnectScreen(slug: state.pathParameters['slug'] ?? ''),
      ),
      // Settings pushes over the shell (Cupertino swipe-back) from the header
      // avatar — it's an account surface, not a primary tab destination.
      GoRoute(
        path: '/settings',
        parentNavigatorKey: _rootKey,
        pageBuilder:
            (context, state) =>
                const CupertinoPage<void>(child: SettingsScreen()),
      ),

      // The primary destinations — each its own branch so state/scroll persist
      // across tab switches. Order: dashboard, nutrition, logging, groups,
      // admin (the last two are off-bar — reachable by route, not the tab bar).
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

/// Cream splash shown on the index route while the redirect resolves. The
/// first frame of brand: the Lora "Nhẩm" wordmark breathing gently on the cream
/// surface, instead of a generic Material spinner. The cream background matches
/// the native LaunchScreen so the native→Flutter handoff is seamless.
class _SplashScreen extends StatefulWidget {
  const _SplashScreen();

  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    // Gentle breathing pulse, paused under reduced-motion.
    if (!WidgetsBinding
        .instance
        .platformDispatcher
        .accessibilityFeatures
        .disableAnimations) {
      _controller.repeat(reverse: true);
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wordmark = Text(
      'Nhẩm',
      style: NhamTextStyles.serifRegular(
        fontSize: 32,
      ).copyWith(color: NhamColors.text),
    );
    return ColoredBox(
      color: NhamColors.surface,
      child: Center(
        child: FadeTransition(
          opacity: Tween<double>(begin: 0.5, end: 1.0).animate(
            CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
          ),
          child: wordmark,
        ),
      ),
    );
  }
}
