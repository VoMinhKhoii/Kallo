import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthState;

/// Bridges Supabase's auth stream — and the Riverpod settles the router cares
/// about — onto a [Listenable] for `GoRouter.refreshListenable`.
///
/// Re-runs the router's redirect on every auth state change (sign-in,
/// sign-out, token refresh) — the go_router equivalent of RN's
/// `onAuthStateChange` re-render — and on the async sources the redirect reads
/// (`router.dart` pings it from four `ref.listen` callbacks).
///
/// **This listenable NEVER notifies inside its caller's stack frame, and that
/// is load-bearing.** go_router re-parses SYNCHRONOUSLY when it notifies:
/// `Router` hands the route information to `GoRouteInformationParser`, whose
/// `_redirect` wraps a synchronous `redirect` in a `SynchronousFuture`, so the
/// `.then` chain — redirect included — runs before `notifyListeners` returns.
/// The app's redirect then reads seven providers.
///
/// [ping] is called from `ref.listen` callbacks, which Riverpod fires from
/// inside `ProviderElementBase._performBuild` while its scheduler is flushing
/// the graph (`ProviderScheduler._performRefresh`, run from
/// `UncontrolledProviderScope.build`). A synchronous provider read from there
/// can re-enter `_performBuild` on an element whose `_dependencies` map the
/// scheduler is mid-iteration over; the rebuild's `_previousDependencies
/// .remove` mutates that very map and Dart throws a `ConcurrentModification
/// Error` over the element's dependency HashMap. Thrown in the build phase it
/// is uncaught: the screen is replaced by an error widget and the app has to
/// be force-quit. That is the TestFlight grey screen of 2026-09-11, reported
/// on the sign-in-after-onboarding path where the session, the profile, the
/// draft and the resume flag all settle in one scheduler tick.
/// `test/shell/router_refresh_test.dart` pins both halves of that.
///
/// Deferring also coalesces those four settles into a single redirect instead
/// of four, which is why [ping] is cheap enough to call from every listener.
///
/// There is deliberately no seed notification in the constructor: nothing can
/// be listening yet, because the `GoRouter` that holds this as its
/// `refreshListenable` is built from it.
class RouterRefresh extends ChangeNotifier {
  RouterRefresh(Stream<AuthState> events) {
    _sub = events.listen(
      (_) => ping(),
      // gotrue surfaces auth failures (refresh blips, expired-session
      // recovery) as errors on this stream. A `listen` without an error
      // handler forwards them to the zone's uncaught-error handler; re-running
      // the redirect is the right response instead, since the client may have
      // dropped the session along the way.
      onError: (Object _, StackTrace _) => ping(),
    );
  }

  late final StreamSubscription<AuthState> _sub;
  bool _scheduled = false;
  bool _disposed = false;

  /// Ask for one redirect re-evaluation, once the current call stack unwinds.
  ///
  /// Repeated calls before that point collapse into a single notification.
  void ping() {
    if (_scheduled || _disposed) return;
    _scheduled = true;
    scheduleMicrotask(() {
      _scheduled = false;
      if (_disposed) return;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _sub.cancel();
    super.dispose();
  }
}
