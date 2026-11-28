import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart'
    as dash;
import 'package:kallo_mobile/features/dashboard/data/logging_day.dart'
    as dash_day;
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_store.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_link.dart';
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
    Future<dash_day.LoggingDayData>? todayCopy,
  }) => ProviderContainer(
    overrides: [
      // Today's own copy of the day (the dashboard bundle's slice). Unless a
      // test hands one over, it never arrives.
      dash.loggingDayProvider.overrideWith(
        (ref, args) => todayCopy ?? Completer<dash_day.LoggingDayData>().future,
      ),
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
    expect((last['copy']! as Map)['signedOut'], 'Sign in to track');
  });

  testWidgets('a pull-to-refresh on Today, landing later, is what it writes', (
    tester,
  ) async {
    // The Log copy loads first; then Today's copy arrives with a meal logged
    // on the web meanwhile. The widget must follow the newer answer.
    final store = _RecordingStore();
    final refreshed = Completer<dash_day.LoggingDayData>();
    final c = container(
      userId: 'u1',
      store: store,
      todayCopy: refreshed.future,
    );
    addTearDown(c.dispose);
    await tester.pumpWidget(_app(c));
    await tester.pumpAndSettle();
    expect((store.saved.last['eaten']! as Map)['kcal'], 450);

    refreshed.complete(
      dash_day.LoggingDayData.fromJson({
        'persistedMeals': [
          for (final (id, kcal) in [('m1', 450), ('w1', 300)])
            {
              'id': id,
              'rawInput': 'bánh mì',
              'loggedAt': DateTime.now().toUtc().toIso8601String(),
              'nutrition': {
                'caloriesKcal': kcal,
                'proteinG': 10,
                'carbohydrateG': 40,
                'fatG': 8,
              },
            },
        ],
      }),
    );
    await tester.pumpAndSettle();
    expect((store.saved.last['eaten']! as Map)['kcal'], 750);
    expect(store.saved.last['meals'], hasLength(2));
  });

  testWidgets(
    'failed profile reload after sign-in does not overwrite widget with default targets',
    (tester) async {
      final store = _RecordingStore();
      final uidState = StateProvider<String?>((ref) => null);
      final fetchGate = Completer<ProfileRow?>();
      final c = ProviderContainer(
        overrides: [
          dash.loggingDayProvider.overrideWith(
            (ref, args) => Completer<dash_day.LoggingDayData>().future,
          ),
          sessionProvider.overrideWith((ref) => Stream<Session?>.value(null)),
          signedInUserIdProvider.overrideWith((ref) => ref.watch(uidState)),
          todayWidgetStoreProvider.overrideWithValue(store),
          loggingDayProvider.overrideWith(_Day.new),
          profileProvider.overrideWith((ref) {
            final uid = ref.watch(signedInUserIdProvider);
            if (uid == null) return null;
            return fetchGate.future;
          }),
        ],
      );
      addTearDown(c.dispose);
      // Seed profileProvider with synchronous signed-out AsyncData(null).
      c.read(profileProvider);
      await tester.pumpWidget(_app(c));
      await tester.pumpAndSettle();
      store.saved.clear();

      // Transition to signed in: profileProvider is reloading (hasValue: true,
      // value: null, isReloading: true), then fails (AsyncError with hasValue: true).
      c.read(uidState.notifier).state = 'u1';
      await tester.pump();
      expect(c.read(profileProvider).isReloading, isTrue);
      expect(store.saved, isEmpty);

      fetchGate.completeError(StateError('offline'));
      await tester.pumpAndSettle();

      final errored = c.read(profileProvider);
      expect(errored.hasError, isTrue);
      expect(errored.hasValue, isTrue);
      expect(
        store.saved,
        isEmpty,
        reason: 'a failed reload must not write default targets to the widget',
      );
    },
  );

  testWidgets(
    'failed profile refresh after a loaded profile still writes new meals with last good targets',
    (tester) async {
      final store = _RecordingStore();
      var shouldFail = false;
      final refreshedDay = Completer<dash_day.LoggingDayData>();
      final c = ProviderContainer(
        overrides: [
          dash.loggingDayProvider.overrideWith(
            (ref, args) => refreshedDay.future,
          ),
          sessionProvider.overrideWith((ref) => Stream<Session?>.value(null)),
          signedInUserIdProvider.overrideWithValue('u1'),
          todayWidgetStoreProvider.overrideWithValue(store),
          loggingDayProvider.overrideWith(_Day.new),
          profileProvider.overrideWith((ref) async {
            if (shouldFail) throw StateError('offline');
            return const ProfileRow({
              'calorieTarget': 1932,
              'proteinTargetG': 145,
              'carbsTargetG': 169,
              'fatTargetG': 75,
            });
          }),
        ],
      );
      addTearDown(c.dispose);
      await tester.pumpWidget(_app(c));
      await tester.pumpAndSettle();
      expect((store.saved.last['target']! as Map)['kcal'], 1932);
      store.saved.clear();

      // Invalidate profileProvider and fail the refetch: AsyncError keeps the
      // last good ProfileRow in valueOrNull.
      shouldFail = true;
      c.invalidate(profileProvider);
      await tester.pumpAndSettle();
      expect(c.read(profileProvider).hasError, isTrue);
      expect(c.read(profileProvider).valueOrNull, isNotNull);

      // A new meal arrives on Today: the widget must still update with the
      // last good targets (1932 kcal) and the new meal total (750 kcal).
      refreshedDay.complete(
        dash_day.LoggingDayData.fromJson({
          'persistedMeals': [
            for (final (id, kcal) in [('m1', 450), ('w1', 300)])
              {
                'id': id,
                'rawInput': 'bánh mì',
                'loggedAt': DateTime.now().toUtc().toIso8601String(),
                'nutrition': {
                  'caloriesKcal': kcal,
                  'proteinG': 10,
                  'carbohydrateG': 40,
                  'fatG': 8,
                },
              },
          ],
        }),
      );
      await tester.pumpAndSettle();

      expect(store.saved, isNotEmpty);
      expect((store.saved.last['target']! as Map)['kcal'], 1932);
      expect((store.saved.last['eaten']! as Map)['kcal'], 750);
    },
  );

  test('the widget tap link is the Today link, and only that', () {
    expect(isTodayWidgetLink(Uri.parse('nham://today')), isTrue);
    expect(isTodayWidgetLink(Uri.parse('nham://invite/abc')), isFalse);
    expect(isTodayWidgetLink(Uri.parse('https://kallo.fit/today')), isFalse);
  });
}
