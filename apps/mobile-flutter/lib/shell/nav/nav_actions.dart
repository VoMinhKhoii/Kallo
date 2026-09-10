import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// The shell's branch roots — the locations that HAVE a tab to come back to.
/// Kept in step with the [StatefulShellRoute] branches in `router.dart`.
const Set<String> _shellRoots = {
  '/dashboard',
  '/nutrition',
  '/circle',
  '/admin',
};

/// Opens the logging feed FULL-SCREEN over whatever the user is looking at
/// (native pass, 2026-08-31): Log is a pill-nav item but not a shell branch —
/// it pushes like Settings does, with Cupertino swipe-back returning to the
/// tab the user came from. Feed state lives in providers, so nothing is lost
/// when the route pops.
///
/// `go('/logging')` would REPLACE the stack and leave nothing to come back to,
/// which is why every "take me to logging" call site routes through here.
///
/// The Today reset is DERIVED, not asked of the caller: from a shell branch
/// the push goes straight over that branch (the "+" sheet lives on the pill
/// nav, so logging a meal from Nutrition or Circle used to silently rewrite
/// the stack to Today and back dropped the user there). From outside the shell
/// — post-welcome, post-paywall, a Settings deep action — there is no branch
/// underneath, so Today goes down first and back has somewhere to go.
void openLogging(GoRouter router) {
  final location = router.state.matchedLocation;
  // Already there — do nothing. `/logging` is not a shell root, so falling
  // through would `go('/dashboard')` and push a SECOND logging route over the
  // first: back would then land on Today instead of the tab the user came
  // from, and a double-fired call (two taps on the pill's Log item, a tap plus
  // a deep link) would stack duplicate logging routes to pop through.
  if (location == '/logging') return;
  if (!_shellRoots.contains(location)) {
    router.go('/dashboard');
  }
  router.push('/logging');
}

/// [openLogging] for the call sites that hold a live [BuildContext].
void goToLogging(BuildContext context) => openLogging(GoRouter.of(context));

/// Opens a location a NOTIFICATION tap resolved to, leaving something under it
/// to go back to.
///
/// A tap can arrive cold — the app was not running, so there is no shell — and
/// `go` alone was the answer to that: it always lands somewhere real. The cost
/// was that the thread page then had NOTHING beneath it, so the back gesture
/// had nowhere to go and only the chevron worked (via [popOr]'s `/circle`
/// fallback). Seeding the branch first and pushing over it gives the swipe a
/// destination while keeping the cold-start guarantee. Same shape as
/// [openLogging], for the same reason.
///
/// A destination that IS a shell branch is just a branch switch — there is
/// nothing to push over it.
void openPushDestination(GoRouter router, String path) {
  if (_shellRoots.contains(path)) {
    router.go(path);
    return;
  }
  if (!_shellRoots.contains(router.state.matchedLocation)) {
    router.go('/circle');
  }
  router.push(path);
}

/// Leaves a screen that may or may not have been pushed: pop when there is
/// something under it, otherwise hand the router to [fallback]. Every route
/// pushed over the shell with `parentNavigatorKey` can be entered cold — a
/// deep link, a notification — with no shell beneath it, where `maybePop` is
/// a no-op and a back chevron does nothing.
void popOr(BuildContext context, void Function(GoRouter router) fallback) {
  final router = GoRouter.of(context);
  if (router.canPop()) {
    router.pop();
  } else {
    fallback(router);
  }
}

/// [popOr] landing in the logging feed. Both paywall exits (dismiss and
/// unlock) need exactly this, and the paywall is reachable both as a push and
/// as a cold-start destination.
void popOrOpenLogging(BuildContext context) => popOr(context, openLogging);
