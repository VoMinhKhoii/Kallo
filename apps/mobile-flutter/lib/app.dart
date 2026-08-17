import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session;

import 'services/analytics/analytics.dart';
import 'services/billing/entitlement_lifecycle_sync.dart';
import 'services/billing/purchases_service.dart';
import 'services/auth/session_provider.dart';
import 'features/circle/logic/circle_deep_links.dart';
import 'features/logging/data/logging_providers.dart';
import 'router.dart';
import 'theme/kallo_theme.dart';

/// Root app widget — ported from the RN `RootLayout` (`app/_layout.tsx`).
///
/// Wires the Nham [ThemeData], the Riverpod-built [GoRouter], and
/// easy_localization's delegates/locale (EasyLocalization already wraps this
/// in `main()`, the equivalent of RN's `LocaleProvider`). The status-bar style
/// is forced dark-content to match RN's `<StatusBar style="dark" />` on the
/// cream surface.
class KalloApp extends ConsumerStatefulWidget {
  const KalloApp({super.key});

  @override
  ConsumerState<KalloApp> createState() => _NhamAppState();
}

class _NhamAppState extends ConsumerState<KalloApp> with WidgetsBindingObserver {
  bool _didSyncInitialSession = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Store changes can happen outside the app (renewal, cancellation,
      // billing recovery). Refresh at a bounded cadence and let the server
      // request RevenueCat recovery only when its projection is stale.
      _synchronizeEntitlements(ref.read(currentSessionProvider)?.user.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    // Tie PostHog identity + the RevenueCat customer to the auth session:
    // identify / logIn on sign-in (email, Google, sign-up, restore). On
    // sign-out we deliberately keep the identified SDK customer instead of
    // creating an anonymous RevenueCat alias; the next authenticated UUID is
    // switched in through the serialized purchase service.
    ref.listen(sessionProvider, (prev, next) {
      final previousUserId = prev?.valueOrNull?.user.id;
      final nextUserId = next.valueOrNull?.user.id;
      _syncSession(
        ref,
        next.valueOrNull,
        previousUserId: previousUserId,
        hadPriorSession: prev?.valueOrNull != null,
      );
      if (previousUserId != nextUserId) {
        _synchronizeEntitlements(nextUserId);
      }
    });

    // Run once with the already-restored session so a launch with an existing
    // sign-in both configures RC with that Supabase uid and identifies
    // analytics on the first frame — the splash redirect reads
    // `auth.currentSession` synchronously, so we do too. `hadPriorSession`
    // is false here, so a signed-out launch never triggers a spurious reset.
    if (!_didSyncInitialSession) {
      _didSyncInitialSession = true;
      _syncSession(
        ref,
        ref.read(currentSessionProvider),
        previousUserId: null,
        hadPriorSession: false,
      );
      _synchronizeEntitlements(ref.read(currentSessionProvider)?.user.id);
    }

    // Wraps the app so a single invite-deep-link listener lives for the whole
    // session, routing `nham://invite/<slug>` (and https invite links) to the
    // in-app connect screen.
    return CircleDeepLinkListener(
      child: MaterialApp.router(
        title: 'Kallo',
        debugShowCheckedModeBanner: false,
        theme: KalloTheme.light(),
        routerConfig: router,
        // Dynamic Type is respected, but capped: the feed's fixed-width
        // columns overflow past ~1.3x.
        builder:
            (context, child) => MediaQuery.withClampedTextScaling(
              maxScaleFactor: 1.3,
              child: child!,
            ),
        // easy_localization wiring (locale source of truth lives on the
        // EasyLocalization wrapper in main()).
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
      ),
    );
  }

  void _synchronizeEntitlements(String? userId) {
    unawaited(ref.read(entitlementLifecycleSyncProvider).synchronize(userId));
  }
}

/// Reconcile analytics identity + the RevenueCat customer with the auth session.
/// Configure is idempotent (guarded inside the service), and account switches
/// are serialized with purchases/restores. Calls fail closed until a key is set.
void _syncSession(
  WidgetRef ref,
  Session? session, {
  required String? previousUserId,
  required bool hadPriorSession,
}) {
  final analytics = ref.read(analyticsProvider);
  final purchases = ref.read(purchasesServiceProvider);
  if (session != null) {
    analytics.identify(session.user.id);
    unawaited(
      purchases.identify(session.user.id).catchError((Object error) {
        // The paywall remains blocked because readyUserId was not set. A later
        // retry can recover without taking down the authenticated app shell.
      }),
    );
  } else {
    if (hadPriorSession) analytics.reset();
    // Authenticated-only app: never create an anonymous RevenueCat customer
    // and never log out to one. The next signed-in UUID is switched directly.
  }

  resetComposerStateForAccountChange(
    ref,
    previousUserId: previousUserId,
    nextUserId: session?.user.id,
  );
}
