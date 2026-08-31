import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Opens the logging feed FULL-SCREEN over the shell (native pass,
/// 2026-08-31): Log is a pill-nav item but not a shell branch — it pushes
/// like Settings does, with Cupertino swipe-back returning to the tab the
/// user came from. Feed state lives in providers, so nothing is lost when
/// the route pops.
///
/// `go('/logging')` would REPLACE the stack and leave nothing to come back
/// to, which is why every "take me to logging" call site routes through
/// here instead.
void goToLogging(BuildContext context) {
  GoRouter.of(context).push('/logging');
}

/// Lands the user in the logging feed from OUTSIDE the shell (post-welcome,
/// post-paywall, a Settings deep action): resets the stack to the Today tab
/// first, then pushes the feed over it — so back still has somewhere to go.
void landInLogging(BuildContext context) {
  final router = GoRouter.of(context);
  router.go('/dashboard');
  router.push('/logging');
}

/// [landInLogging] for call sites that hold a [GoRouter] but no live context
/// (e.g. a sheet that pops itself first).
void landInLoggingWith(GoRouter router) {
  router.go('/dashboard');
  router.push('/logging');
}
