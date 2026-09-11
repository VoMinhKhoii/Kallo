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
void openLogging(GoRouter router) =>
    pushOverShell(router, base: '/dashboard', path: '/logging');

/// [openLogging] for the call sites that hold a live [BuildContext].
void goToLogging(BuildContext context) => openLogging(GoRouter.of(context));

/// Opens [path] with a shell branch under it, so back has somewhere to go.
///
/// A destination can be reached cold — the app was not running, so there is no
/// shell — and `go` alone was the answer to that: it always lands somewhere
/// real. The cost was that the destination then had NOTHING beneath it, so the
/// back gesture had nowhere to go and only the chevron worked (via [popOr]'s
/// fallback). Seeding [base] first and pushing over it gives the swipe a
/// destination while keeping the cold-start guarantee.
///
/// [base] is the caller's, not this file's: which branch belongs under a
/// notification's thread is `features/notifications` knowledge, and hard-coding
/// `/circle` here put a feature's routing table inside the shell.
///
/// A destination that IS a shell branch is just a branch switch — there is
/// nothing to push over it.
void pushOverShell(
  GoRouter router, {
  required String base,
  required String path,
}) {
  final at = router.state.matchedLocation;
  // Already there — do nothing. Falling through would seed [base] and push a
  // SECOND copy: back would then land on the seed instead of where the user
  // came from, and a double-fired call (two taps on the pill's Log item, two
  // taps on the same notification, a tap plus a deep link) would stack
  // duplicate routes to pop through.
  if (at == path) return;
  if (_shellRoots.contains(path)) {
    router.go(path);
    return;
  }
  if (_shellRoots.contains(at)) {
    // Already standing on a branch — push straight over it. ONE call, which
    // is why this path never showed the bug below.
    router.push(path);
    return;
  }
  _seedThenPush(router, base: base, path: path);
}

/// Seeds [base] and pushes [path] over it — as two navigations that are
/// ORDERED, which `go` immediately followed by `push` is not.
///
/// `GoRouter.push` reads its base synchronously — `base:
/// routerDelegate.currentConfiguration` (`go_router/src/router.dart`) — while
/// `go` only reaches the delegate after the router's async route parse. So
/// `router.go(base); router.push(path);` builds the push on the stack we are
/// STANDING on rather than the one we just asked for, and the two land in a
/// nondeterministic order: sometimes `[base, path]`, sometimes the seed
/// arriving last and wiping the pushed route out from under the navigator,
/// which rendered as a bare grey screen that only an app restart cleared.
///
/// It only ever bit the paths that need the seed — the first run's hand-off
/// from `/welcome`, the paywall's two exits, a cold notification tap — which
/// is why the pill nav's Log item, pushing from a branch it is already on, has
/// always been fine.
///
/// So: wait for the delegate to actually report a stack that is no longer the
/// one we left, then push. Not for [base] specifically — if a redirect sent
/// the seed somewhere else, opening [path] over THAT is still what the caller
/// asked for.
///
/// **This is a hazard fix, not a proven one.** The synchronous base capture is
/// plain in go_router's source, and the paths that show the grey screen are
/// exactly the ones that take this branch — but the ordering could not be made
/// to fail in a test, so it is not established as the cause. It therefore
/// carries a same-frame fallback: if the delegate has not moved by the end of
/// the frame, push anyway. That keeps this strictly no worse than the
/// `go`-then-`push` it replaces — including if a redirect returns the seed to
/// where we started, which would otherwise leave the caller here forever.
void _seedThenPush(
  GoRouter router, {
  required String base,
  required String path,
}) {
  final delegate = router.routerDelegate;
  final from = delegate.currentConfiguration.uri.toString();
  var pushed = false;
  late final VoidCallback onSettled;

  void pushOnce() {
    if (pushed) return;
    pushed = true;
    delegate.removeListener(onSettled);
    router.push(path);
  }

  onSettled = () {
    if (pushed) return;
    if (delegate.currentConfiguration.uri.toString() == from) return;
    pushOnce();
  };
  delegate.addListener(onSettled);
  router.go(base);
  WidgetsBinding.instance.addPostFrameCallback((_) => pushOnce());
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
