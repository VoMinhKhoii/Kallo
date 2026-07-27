import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/analytics.dart';
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

    // Tie PostHog identity to the auth session: identify on sign-in (email,
    // Google, sign-up, restore) and reset on sign-out. No-op until a PostHog
    // key is configured. Mirrors the RN provider's identify/reset behavior.
    ref.listen(sessionProvider, (prev, next) {
      final analytics = ref.read(analyticsProvider);
      final session = next.valueOrNull;
      if (session != null) {
        analytics.identify(session.user.id);
      } else if (prev?.valueOrNull != null) {
        analytics.reset();
      }
    });

    // Wraps the app so a single invite-deep-link listener lives for the whole
    // session, routing `nham://invite/<slug>` (and https invite links) to the
    // in-app connect screen.
    return CircleDeepLinkListener(
      child: MaterialApp.router(
        title: 'Kallo',
        debugShowCheckedModeBanner: false,
        theme: NhamTheme.light(),
        routerConfig: router,
        // Dynamic Type is respected, but capped: the feed's fixed-width
        // columns (macro labels, gram readouts, stepper values) overflow past
        // ~1.3x. No lower bound — smaller text is a legitimate preference and
        // nothing breaks below 1.0.
        builder: (context, child) => MediaQuery.withClampedTextScaling(
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
}
