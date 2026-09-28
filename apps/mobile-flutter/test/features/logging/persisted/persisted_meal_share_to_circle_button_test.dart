import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/widgets/actions/meal_action_icon_button.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_share_to_circle_button.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n_test_loader.dart';

// A "Share card" action used to sit beside this toggle once a meal was shared.
// It linked to the macro-card image, which renders only for a signed-in viewer
// in the sharer's circle, so the people it was sent to got a JSON error.
// The toggle now stands alone.

const _shared = MealShare(shareId: 's1', visibility: 'circle');

/// Answers the toggle's POST with the visibility it asked for.
class _Api extends ApiClient {
  final bodies = <Map<String, dynamic>>[];

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final sent = body! as Map<String, dynamic>;
    bodies.add(sent);
    return <String, dynamic>{'shareId': 's1', 'visibility': sent['visibility']}
        as T;
  }
}

Future<void> _pump(WidgetTester tester, MealShare? share, _Api api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        assetLoader: const FsL10nLoader(),
        fallbackLocale: const Locale('en'),
        startLocale: const Locale('en'),
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(
                  body: Row(
                    children: [
                      PersistedMealShareToCircleButton(
                        mealId: 'm1',
                        share: share,
                      ),
                    ],
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

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

  testWidgets('a shared meal shows the circle toggle and nothing else', (
    tester,
  ) async {
    await _pump(tester, _shared, _Api());

    expect(find.byType(MealActionIconButton), findsOneWidget);
    expect(find.byIcon(LucideIcons.check300), findsOneWidget);
    expect(find.byIcon(LucideIcons.share2300), findsNothing);
  });

  testWidgets('tapping it unshares the meal and says so', (tester) async {
    final api = _Api();
    await _pump(tester, _shared, api);

    await tester.tap(find.byIcon(LucideIcons.check300));
    await tester.pumpAndSettle();

    expect(api.bodies, [
      {'mealId': 'm1', 'visibility': 'private'},
    ]);
    expect(find.byIcon(LucideIcons.users300), findsOneWidget);
    expect(find.text('No longer shared with your circle'), findsOneWidget);

    // Run out the toast's hold timer so nothing outlives the test.
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
  });

  testWidgets('a refetch that shares the meal re-seeds the toggle', (
    tester,
  ) async {
    final api = _Api();
    await _pump(tester, null, api);
    expect(find.byIcon(LucideIcons.users300), findsOneWidget);

    await _pump(tester, _shared, api);
    expect(find.byIcon(LucideIcons.check300), findsOneWidget);
    expect(api.bodies, isEmpty);
  });
}
