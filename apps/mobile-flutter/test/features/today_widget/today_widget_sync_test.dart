import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_store.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_sync.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session;

import '../../l10n_test_loader.dart';

/// Records what would reach the widget instead of writing it.
class _RecordingStore extends TodayWidgetStore {
  _RecordingStore() : super(isIOS: true);
  final List<Map<String, Object?>> saved = [];

  @override
  Future<void> save(Map<String, Object?> snapshot) async => saved.add(snapshot);
}

class _Day extends LoggingDayNotifier {
  @override
  Future<LoggingDayData> build(LoggingDayArgs arg) async => LoggingDayData(
    persistedMeals: [
      PersistedMeal(
        id: 'm1',
        rawInput: 'phở bò',
        loggedAt: DateTime.now().toUtc().toIso8601String(),
        nutrition: const MealNutrition(
          caloriesKcal: 450,
          proteinG: 30,
          carbohydrateG: 55,
          fatG: 12,
        ),
        mealItemGroups: const [],
      ),
    ],
    pendingConfirmations: const [],
  );
}

Widget _app(ProviderContainer container) => UncontrolledProviderScope(
  container: container,
  child: EasyLocalization(
    supportedLocales: const [Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            // The same place `app.dart` mounts it: under the localizations.
            builder:
                (context, child) =>
                    TodayWidgetSync(child: child ?? const SizedBox()),
            home: const SizedBox(),
          ),
    ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  setUpAll(() async {
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/shared_preferences'),
      (call) async => call.method == 'getAll' ? <String, Object>{} : null,
    );
    // The widget-tap link listener: no launch link, no stream.
    messenger.setMockMethodCallHandler(
      const MethodChannel('com.llfbandit.app_links/messages'),
      (call) async => null,
    );
    messenger.setMockMethodCallHandler(
      const MethodChannel('com.llfbandit.app_links/events'),
      (call) async => null,
    );
    await EasyLocalization.ensureInitialized();
  });

  ProviderContainer container({
    required String? userId,
    required _RecordingStore store,
  }) => ProviderContainer(
    overrides: [
      sessionProvider.overrideWith((ref) => Stream<Session?>.value(null)),
      signedInUserIdProvider.overrideWithValue(userId),
      todayWidgetStoreProvider.overrideWithValue(store),
      loggingDayProvider.overrideWith(_Day.new),
      profileProvider.overrideWith(
        (ref) async => const ProfileRow({
          'calorieTarget': 1932,
          'proteinTargetG': 145,
          'carbsTargetG': 169,
          'fatTargetG': 75,
        }),
      ),
    ],
  );

  testWidgets('signed in: writes today, in words, from the day and profile', (
    tester,
  ) async {
    final store = _RecordingStore();
    final c = container(userId: 'u1', store: store);
    addTearDown(c.dispose);
    await tester.pumpWidget(_app(c));
    await tester.pumpAndSettle();

    final last = store.saved.last;
    expect(last['signedIn'], isTrue);
    expect(last['eaten'], {'kcal': 450, 'protein': 30, 'carbs': 55, 'fat': 12});
    expect((last['target']! as Map)['kcal'], 1932);
    expect((last['meals']! as List).single, containsPair('text', 'Phở bò'));
    // Resolved below the localizations: words, never `dashboard.*` keys.
    expect((last['copy']! as Map)['kcalEaten'], 'Kcal eaten');
  });

  testWidgets('signed out: writes the signed-out card and no day', (
    tester,
  ) async {
    final store = _RecordingStore();
    final c = container(userId: null, store: store);
    addTearDown(c.dispose);
    await tester.pumpWidget(_app(c));
    await tester.pumpAndSettle();

    final last = store.saved.last;
    expect(last['signedIn'], isFalse);
    expect(last['meals'], isEmpty);
    expect((last['eaten']! as Map)['kcal'], 0);
    expect((last['copy']! as Map)['signedOut'], 'Not signed in.');
  });

  test('the widget tap link is the Today link, and only that', () {
    expect(isTodayWidgetLink(Uri.parse('nham://today')), isTrue);
    expect(isTodayWidgetLink(Uri.parse('nham://invite/abc')), isFalse);
    expect(isTodayWidgetLink(Uri.parse('https://kallo.fit/today')), isFalse);
  });
}
