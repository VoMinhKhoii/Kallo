import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session;

import 'data/analytics.dart';
import 'data/billing/purchases_service.dart';
import 'data/session_provider.dart';
import 'features/circle/circle_deep_links.dart';
import 'router.dart';
import 'theme/nham_theme.dart';

/// Root app widget — ported from the RN `RootLayout` (`app/_layout.tsx`).
///
/// Wires the Nham [ThemeData], the Riverpod-built [GoRouter], and
/// easy_localization's delegates/locale (EasyLocalization already wraps this
/// in `main()`, the equivalent of RN's `LocaleProvider`). The status-bar style
/// is forced dark-content to match RN's `<StatusBar style="dark" />` on the
/// cream surface.
class NhamApp extends ConsumerWidget {
  const NhamApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // Tie PostHog identity + the RevenueCat customer to the auth session:
    // identify / logIn on sign-in (email, Google, sign-up, restore) and
    // reset / logOut on sign-out. Both are env-gated no-ops until their keys
    // are configured. Mirrors the RN provider's identify/reset behavior.
    ref.listen(sessionProvider, (prev, next) {
      _syncSession(
        ref,
        next.valueOrNull,
        hadPriorSession: prev?.valueOrNull != null,
      );
    });

    // Run once with the already-restored session so a launch with an existing
    // sign-in both configures RC with that Supabase uid and identifies
    // analytics on the first frame — the splash redirect reads
    // `auth.currentSession` synchronously, so we do too. `hadPriorSession`
    // is false here, so a signed-out launch never triggers a spurious reset.
    _syncSession(ref, ref.read(currentSessionProvider), hadPriorSession: false);

    // Wraps the app so a single invite-deep-link listener lives for the whole
    // session, routing `nham://invite/<slug>` (and https invite links) to the
    // in-app connect screen.
    return CircleDeepLinkListener(
      child: MaterialApp.router(
        title: 'Nhẩm',
        debugShowCheckedModeBanner: false,
        theme: NhamTheme.light(),
        routerConfig: router,
        // easy_localization wiring (locale source of truth lives on the
        // EasyLocalization wrapper in main()).
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
      ),
    );
  }
}

/// Reconcile analytics identity + the RevenueCat customer with the auth session.
/// Configure is idempotent (guarded inside the service); logIn/logOut are
/// safe to repeat. All calls are env-gated no-ops until their keys are set.
void _syncSession(
  WidgetRef ref,
  Session? session, {
  required bool hadPriorSession,
}) {
  final analytics = ref.read(analyticsProvider);
  final purchases = ref.read(purchasesServiceProvider);
  if (session != null) {
    analytics.identify(session.user.id);
    unawaited(
      purchases
          .configure(initialAppUserID: session.user.id)
          .then((_) => purchases.logIn(session.user.id)),
    );
  } else {
    if (hadPriorSession) analytics.reset();
    // Configure (anonymous) so the paywall can fetch offerings while signed
    // out, then detach any prior RC customer.
    unawaited(purchases.configure().then((_) => purchases.logOut()));
  }
}
