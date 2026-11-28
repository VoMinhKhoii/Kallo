import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'features/onboarding/providers/onboarding_draft_providers.dart';
import 'features/onboarding/providers/onboarding_providers.dart';
import 'services/auth/session_provider.dart';

/// The router's [GoRouter.refreshListenable]: everything that re-runs the
/// redirect, kept out of [routerProvider] so a test can run this exact wiring.
final routerRefreshProvider = Provider<GoRouterAuthRefresh>((ref) {
  // Re-run redirects whenever Supabase auth state changes.
  final refresh = GoRouterAuthRefresh(ref.read(authEventsProvider));
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
  return refresh;
});

/// Bridges Supabase's auth stream to a [Listenable] for [GoRouter.refreshListenable].
///
/// Re-runs the router's redirect on every auth state change (sign-in,
/// sign-out, token refresh) — the go_router equivalent of RN's
/// `onAuthStateChange` re-render.
class GoRouterAuthRefresh extends ChangeNotifier {
  GoRouterAuthRefresh(Stream<AuthState> events) {
    notifyListeners();
    _sub = events.listen(
      (_) => notifyListeners(),
      // gotrue surfaces auth failures (refresh blips, expired-session
      // recovery) as errors on this stream. A `listen` without an error
      // handler forwards them to the zone's uncaught-error handler; re-running
      // the redirect is the right response instead, since the client may have
      // dropped the session along the way.
      onError: (Object _, StackTrace __) => notifyListeners(),
    );
  }

  late final StreamSubscription<AuthState> _sub;

  bool _pingScheduled = false;
  bool _disposed = false;

  /// Lets external Riverpod listeners (e.g. the onboarding-resume decision)
  /// trigger a redirect re-evaluation.
  ///
  /// The redirect runs on the next microtask, never inside the listener: those
  /// fire while Riverpod is mid-refresh, and go_router runs the redirect
  /// synchronously, so its `ref.read`s rebuilt a provider in the middle of
  /// refreshing that provider's own dependencies. On sign-out that threw
  /// "Concurrent modification during iteration" and wedged Riverpod's
  /// scheduler. Pings within one refresh share one redirect.
  void ping() {
    if (_pingScheduled) return;
    _pingScheduled = true;
    scheduleMicrotask(() {
      _pingScheduled = false;
      if (!_disposed) notifyListeners();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _sub.cancel();
    super.dispose();
  }
}
