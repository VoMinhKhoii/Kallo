import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// Long-press a sent message → Edit → its words come back to the composer.
///
/// The bubble that offers Edit cannot reach the composer's controller — it
/// renders inside a meal card, arbitrarily deep in the day's list — so it parks
/// the text in [composerRefillProvider] and the dock applies it. These tests
/// drive that seam from the provider end against the REAL feed, because the
/// interesting failures are all on the receiving side: a draft silently
/// destroyed, or a slot left full so the second Edit does nothing.
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

  Widget app(ProviderContainer container) => UncontrolledProviderScope(
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
          home: const Scaffold(
            body: FeedArea(profile: _profile, date: '2026-01-01'),
          ),
        ),
      ),
    ),
  );

  Future<ProviderContainer> pumpFeed(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_FakeApi())],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(app(container));
    await tester.pumpAndSettle();
    return container;
  }

  TextField composer(WidgetTester tester) =>
      tester.widget<TextField>(find.byType(TextField));

  String composerText(WidgetTester tester) => composer(tester).controller!.text;

  /// Park a message the way the bubble's Edit action does.
  Future<void> edit(
    WidgetTester tester,
    ProviderContainer container,
    String message,
  ) async {
    container.read(composerRefillProvider.notifier).state = message;
    await tester.pumpAndSettle();
  }

  testWidgets('a parked message lands in the composer', (tester) async {
    final container = await pumpFeed(tester);

    await edit(tester, container, 'phở bò tái nạm, ít bánh');

    expect(composerText(tester), 'phở bò tái nạm, ít bánh');
    // Edit is only half done if the user still has to tap the field: it lands
    // focused, with the caret past the last word, ready to be changed.
    expect(composer(tester).focusNode?.hasFocus, isTrue);
    expect(
      composer(tester).controller!.selection,
      TextSelection.collapsed(offset: composerText(tester).length),
    );
    // Emptied on the way out — see below for why that matters.
    expect(container.read(composerRefillProvider), isNull);
  });

  testWidgets('the message is refilled exactly as it was sent', (tester) async {
    final container = await pumpFeed(tester);

    // The live turn's footer hands the bubble its raw input untrimmed
    // (`feed_footer.dart`), and Copy puts that same string on the clipboard.
    // Edit must not quietly disagree with Copy about where the message starts
    // and ends — the trim belongs to the "is there anything here?" question,
    // not to what lands in the field.
    await edit(tester, container, '  phở bò tái nạm\n');

    expect(composerText(tester), '  phở bò tái nạm\n');
  });

  testWidgets('a message that is only whitespace refills nothing', (
    tester,
  ) async {
    final container = await pumpFeed(tester);
    await tester.enterText(find.byType(TextField), 'cơm tấm');
    await tester.pumpAndSettle();

    await edit(tester, container, '   \n  ');

    // Nothing to put in the field, so the draft is left alone rather than
    // displaced by blanks.
    expect(composerText(tester), 'cơm tấm');
    expect(find.text('Draft replaced'), findsNothing);
  });

  testWidgets('an empty composer is filled without a word about it', (
    tester,
  ) async {
    final container = await pumpFeed(tester);

    await edit(tester, container, 'cơm tấm sườn bì');

    // Nothing was displaced, so there is nothing to tell the user or undo.
    expect(find.text('Draft replaced'), findsNothing);
    expect(find.text('Undo'), findsNothing);
  });

  testWidgets('a draft in the way is displaced, said so, and recoverable', (
    tester,
  ) async {
    final container = await pumpFeed(tester);

    await tester.enterText(find.byType(TextField), 'bún chả half eaten');
    await tester.pumpAndSettle();

    await edit(tester, container, 'phở bò tái nạm');

    expect(composerText(tester), 'phở bò tái nạm');
    // Silently eating a half-typed meal is the one outcome this must not have.
    expect(find.text('Draft replaced'), findsOneWidget);

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();

    expect(composerText(tester), 'bún chả half eaten');
    await tester.pumpAndSettle(const Duration(seconds: 6));
  });

  testWidgets('editing the same message twice still refills the second time', (
    tester,
  ) async {
    final container = await pumpFeed(tester);
    const message = 'hai quả trứng luộc';

    await edit(tester, container, message);
    expect(composerText(tester), message);

    // The user changes their mind, clears the field, and holds the same bubble
    // again. A StateProvider notifies only on a CHANGE, so if the slot still
    // held this text the second Edit would silently do nothing — which is the
    // whole reason the refill empties it.
    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();
    expect(composerText(tester), isEmpty);

    await edit(tester, container, message);

    expect(composerText(tester), message);
    await tester.pumpAndSettle(const Duration(seconds: 6));
  });
}
