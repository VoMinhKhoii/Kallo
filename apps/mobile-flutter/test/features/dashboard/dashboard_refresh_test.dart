import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';

import '../../l10n_test_loader.dart';

/// Today was the one primary scrollable with no pull-to-refresh — Circle,
/// Nutrition and the Log feed all had [KalloRefresh] already. Overscrolling it
/// did nothing at all, so a stale day could only be fixed by leaving the tab.
const _userId = '11111111-1111-1111-1111-111111111111';

final _session = Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: const User(
    id: _userId,
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Map<String, dynamic> _bundleJson() => {
      'profile': null,
      'day': {'persistedMeals': <dynamic>[]},
      'weightSummary': {
        'range': '30d',
        'weights': <dynamic>[],
        'weightDates': <dynamic>[],
        'currentWeight': 70.0,
        'todayWeight': null,
        'weightPlaceholder': 70.0,
        'daysLogged': 0,
        'periodStartWeight': 70.0,
        'expectedEndWeight': 68.0,
        'goalDirection': 'down',
        'periodElapsedDays': 0,
        'projectedEndWeight': 69.0,
        'canProject': false,
      },
      'heatmap': {'cells': <dynamic>[], 'monthHeaders': <dynamic>[]},
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('pulling Today down refetches the dashboard bundle',
      (tester) async {
    var loads = 0;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentSessionProvider.overrideWithValue(_session),
          dashboardBundleProvider.overrideWith((ref, args) async {
            loads++;
            return DashboardBundle.fromJson(_bundleJson());
          }),
        ],
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder: (context) => MaterialApp(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              home: const DashboardScreen(),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(loads, 1, reason: 'the first load should have run');
    expect(find.byType(KalloRefresh), findsOneWidget,
        reason: 'Today must carry the app\'s shared pull-to-refresh');

    // Overscroll at the top, the way a thumb does.
    await tester.fling(find.byType(KalloRefresh), const Offset(0, 320), 1000);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    expect(loads, 2, reason: 'the pull must refetch the bundle');
  });
}
