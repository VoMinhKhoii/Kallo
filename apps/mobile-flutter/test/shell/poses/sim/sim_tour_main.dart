// An app entrypoint, not a test: the pose fixtures on a real simulator.
//
// The widget tests in `test/shell/poses/` render the app at iPhone Duo's window sizes,
// but only the Duo simulator draws the system's side of the picture: the
// status column, the Dynamic Island, the fold. This boots the production
// router and shell against the same fake API the tests use, signed in, and
// goes straight to one route, so a script can launch it once per surface and
// screenshot the simulator:
//
//   flutter build ios --simulator --debug -t test/shell/poses/sim/sim_tour_main.dart
//   echo /nutrition > "$(xcrun simctl get_app_container <udid> com.khoivo.nham data)/tmp/duo_route.txt"
//   xcrun simctl launch --terminate-running-process <udid> com.khoivo.nham
//
// `/onboarding@5` opens the wizard on its fifth screen (the long one, cooking
// habits) by handing it a draft that already reached the fourth.
//
// It appends the window's size and insets to `duo_metrics.txt` in the app's
// temp folder on every change, which is how the numbers in `harness/poses.dart` get
// re-measured.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';
import 'package:kallo_mobile/shell/nav/nav_actions.dart';

import '../harness/fixture_api.dart';
import '../harness/fixtures.dart';
import '../harness/pose_overrides.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await initializeDateFormatting();
  GoogleFonts.config.allowRuntimeFetching = false;

  final requested = _requestedRoute().split('@');
  final route = requested.first;
  final screen = requested.length > 1 ? int.tryParse(requested[1]) : null;
  final fixtures = PoseFixtures();
  final container = ProviderContainer(
    overrides: [
      ...poseOverrides(
        fixtures: fixtures,
        api: fixtureApi(fixtures),
        signedIn:
            ![
              '/sign-in',
              '/start',
              '/sign-in/email',
              '/onboarding',
            ].contains(route),
      ),
      // In memory, so a draft seeded for one launch is not in the simulator's
      // keychain for the next.
      onboardingDraftStoreProvider.overrideWithValue(
        OnboardingDraftStore(storage: _MemoryStore(openOn: screen)),
      ),
    ],
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
  // The router's own first redirect (splash to home) lands a few frames
  // after launch, and a `go` before it is overwritten. Keep asking until the
  // router is where the script wants it.
  var tries = 0;
  Timer.periodic(const Duration(milliseconds: 300), (timer) {
    final shown = router.routeInformationProvider.value.uri.path;
    // Log is reached the way the app reaches it: pushed over the tab shell,
    // so its column shows the shell's capsule. A push does not move the
    // reported URL; the top route's location does.
    final log = route == '/logging';
    final path = log && shown != '/' ? router.state.matchedLocation : shown;
    _note('DUO_ROUTE wanted=$route at=$path try=$tries');
    if (path == route || ++tries > 20) return timer.cancel();
    if (shown == '/') return;
    log ? openLogging(router) : router.go(route);
  });
}

/// The route to open: a file the script drops in the app's temp folder, or
/// the `DUO_ROUTE` environment variable, or Today.
String _requestedRoute() {
  final file = File('${Directory.systemTemp.path}/duo_route.txt');
  if (file.existsSync()) {
    final wanted = file.readAsStringSync().trim();
    if (wanted.startsWith('/')) return wanted;
  }
  return Platform.environment['DUO_ROUTE'] ?? '/dashboard';
}

/// The onboarding draft's storage for one launch: empty, or holding a draft
/// that reached the screen before the one the script asked for.
class _MemoryStore implements KeyValueStore {
  _MemoryStore({int? openOn}) {
    if (openOn == null || openOn < 2) return;
    _values[kOnboardingDraftKey] = jsonEncode(
      OnboardingDraft(screenReached: openOn - 1).toJson(),
    );
  }

  final _values = <String, String>{};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async => _values[key] = value;

  @override
  Future<void> delete(String key) async => _values.remove(key);
}

/// A file as well as the log: `simctl launch --stdout` does not carry Dart's
/// print on iOS, and the app's temp folder is easy to read back.
void _note(String line) {
  File(
    '${Directory.systemTemp.path}/duo_metrics.txt',
  ).writeAsStringSync('$line\n', mode: FileMode.append);
  debugPrint(line);
}

/// Prints what the engine reports for this window each time it changes.
class _MetricsLog extends StatelessWidget {
  const _MetricsLog({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final line =
        'DUO_METRICS size=${mq.size.width}x${mq.size.height} '
        'padding=${_ltrb(mq.padding)} viewPadding=${_ltrb(mq.viewPadding)} '
        'viewInsets=${_ltrb(mq.viewInsets)} dpr=${mq.devicePixelRatio} '
        'displayFeatures=${mq.displayFeatures.length}';
    _note(line);
    return child;
  }

  static String _ltrb(EdgeInsets e) =>
      '${e.left},${e.top},${e.right},${e.bottom}';
}
