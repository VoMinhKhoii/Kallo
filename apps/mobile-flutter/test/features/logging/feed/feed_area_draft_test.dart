import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_ui_state.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// Switching accounts with the Log screen MOUNTED must not tear a live
/// controller out from under it.
///
/// The composer's [MentionTextEditingController] used to live in a provider
/// that watched the signed-in user. FeedArea captured it once into a
/// `late final` and handed it to the relog picker, the analysis run, the
/// submitter and MealInput's TextField — so an A→B switch (userId stays
/// non-null, LoggingScreen stays mounted) disposed it under all of them, and
/// `MealInput.dispose()`'s `removeListener` threw on a dead controller.
class _FakeApi extends ApiClient {
  @override
  Future<T> get<T>(String path) async =>
      <String, dynamic>{
            'persistedMeals': <dynamic>[],
            'pendingConfirmations': <dynamic>[],
          }
          as T;
}

const _profile = LoggingProfile(
  userId: 'user-a',
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 65,
);

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

  /// The Log screen, on one app-lifetime container, with [body] as the route.
  Widget app(ProviderContainer container, Widget body) =>
      UncontrolledProviderScope(
        container: container,
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
              home: Scaffold(body: body),
            ),
          ),
        ),
      );

  const feed = FeedArea(profile: _profile, date: '2026-01-01');

  testWidgets('an account switch under a mounted composer empties it, safely', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final owner = StateProvider<String?>((ref) => 'user-a');
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(_FakeApi()),
        loggingUiOwnerProvider.overrideWith((ref) => ref.watch(owner)),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(app(container, feed));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'bún chả half eaten');
    await tester.pumpAndSettle();
    expect(find.text('bún chả half eaten'), findsOneWidget);

    // Account B signs in on the same device while the feed is on screen.
    container.read(owner.notifier).state = 'user-b';
    await tester.pumpAndSettle();

    expect(
      find.text('bún chả half eaten'),
      findsNothing,
      reason: "one account's draft must not greet the next",
    );

    // And the composer still WORKS: the old controller was disposed under the
    // field, so the next keystroke notified a dead ChangeNotifier.
    await tester.enterText(find.byType(TextField), 'cơm tấm');
    await tester.pumpAndSettle();
    expect(
      tester.takeException(),
      isNull,
      reason: 'nothing may be used after being disposed',
    );
    expect(find.text('cơm tấm'), findsOneWidget);
  });

  testWidgets('the draft survives the Log route being popped', (tester) async {
    // Log is a full-screen push: its whole subtree dies on every pop. What the
    // user would call "mine" — the half-typed meal — lives in the container as
    // plain data and seeds the next visit's controller (TestFlight regression,
    // 2026-08-31).
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_FakeApi())],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(app(container, feed));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'phở bò tái');
    await tester.pumpAndSettle();

    await tester.pumpWidget(app(container, const SizedBox.shrink()));
    await tester.pumpAndSettle();
    await tester.pumpWidget(app(container, feed));
    await tester.pumpAndSettle();

    expect(find.text('phở bò tái'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
