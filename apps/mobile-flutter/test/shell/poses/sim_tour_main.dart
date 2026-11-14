// An app entrypoint, not a test: the pose fixtures on a real simulator.
//
// The widget tests in this folder render the app at iPhone Duo's window sizes,
// but only the Duo simulator draws the system's side of the picture: the
// status column, the Dynamic Island, the fold. This boots the production
// router and shell against the same fake API the tests use, signed in, and
// goes straight to one route, so a script can launch it once per surface and
// screenshot the simulator:
//
//   flutter build ios --simulator --debug -t test/shell/poses/sim_tour_main.dart
//   SIMCTL_CHILD_DUO_ROUTE=/nutrition xcrun simctl launch <udid> com.khoivo.nham
//
// It logs the window's size and insets on every change (lines starting
// `DUO_METRICS`), which is how the numbers in `poses.dart` get re-measured.
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import 'fixture_api.dart';
import 'fixtures.dart';
import 'pose_overrides.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await initializeDateFormatting();
  GoogleFonts.config.allowRuntimeFetching = false;

  final route = Platform.environment['DUO_ROUTE'] ?? '/dashboard';
  final fixtures = PoseFixtures();
  final container = ProviderContainer(
    overrides: poseOverrides(
      fixtures: fixtures,
      api: fixtureApi(fixtures),
      signedIn: route != '/sign-in' && route != '/start',
    ),
  );
  // The router reads the session on its first redirect; resolve it first, as
  // the app does on a warm launch.
  await container.read(sessionProvider.future);
  await container.read(onboardingDraftProvider.future);
  final router = container.read(routerProvider);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        startLocale: const Locale('en'),
        fallbackLocale: const Locale('en'),
        path: 'assets/l10n',
        child: Builder(
          builder:
              (context) => MaterialApp.router(
                debugShowCheckedModeBanner: false,
                theme: kalloAppTheme(),
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                routerConfig: router,
                builder:
                    (context, child) =>
                        _MetricsLog(child: child ?? const SizedBox.shrink()),
              ),
        ),
      ),
    ),
  );
  WidgetsBinding.instance.addPostFrameCallback((_) => router.go(route));
}

/// Prints what the engine reports for this window each time it changes.
class _MetricsLog extends StatelessWidget {
  const _MetricsLog({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    // ignore: avoid_print
    print(
      'DUO_METRICS size=${mq.size.width}x${mq.size.height} '
      'padding=${_ltrb(mq.padding)} viewPadding=${_ltrb(mq.viewPadding)} '
      'viewInsets=${_ltrb(mq.viewInsets)} dpr=${mq.devicePixelRatio} '
      'displayFeatures=${mq.displayFeatures.length}',
    );
    return child;
  }

  static String _ltrb(EdgeInsets e) =>
      '${e.left},${e.top},${e.right},${e.bottom}';
}
