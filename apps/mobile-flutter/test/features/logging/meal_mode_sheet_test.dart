import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';

import '../../l10n_test_loader.dart';

/// The mode sheet's cheat-intensity disclosure — the "Effort … Medium ›" row.
///
/// Two things are load-bearing. It must NOT appear for a mode that has no
/// intensity (a row that means nothing for three of the four modes is worse
/// than no row), and what it sets must land in `cheatIntensityProvider` — the
/// one the analyze call reads — rather than in the sheet's own state, which
/// dies with the route.
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

  Future<ProviderContainer> openSheet(
    WidgetTester tester,
    MealLogMode current,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
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
              home: Scaffold(
                body: Builder(
                  builder: (c) => TextButton(
                    onPressed: () => showMealModeSheet(c, current: current),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('no intensity row on a mode that has no intensity', (
    tester,
  ) async {
    await openSheet(tester, MealLogMode.normal);

    expect(find.text('logging.modeSelector.normal'.tr()), findsOneWidget);
    expect(find.text('logging.cheatIntensity.title'.tr()), findsNothing);
    expect(find.text('logging.cheatIntensity.medium'.tr()), findsNothing);
  });

  testWidgets('cheat mode shows the intensity row with the current value', (
    tester,
  ) async {
    await openSheet(tester, MealLogMode.cheat);

    expect(find.text('logging.cheatIntensity.title'.tr()), findsOneWidget);
    expect(
      find.text('logging.cheatIntensity.medium'.tr()),
      findsOneWidget,
      reason: 'the default reads back on the row, collapsed',
    );
    // The levels stay behind the disclosure until it is opened.
    expect(find.text('logging.cheatIntensity.heavy'.tr()), findsNothing);
  });

  testWidgets('picking a level persists it to the provider the analyze reads', (
    tester,
  ) async {
    final container = await openSheet(tester, MealLogMode.cheat);
    expect(container.read(cheatIntensityProvider), CheatIntensity.medium);

    await tester.tap(find.text('logging.cheatIntensity.title'.tr()));
    await tester.pumpAndSettle();
    expect(find.text('logging.cheatIntensity.light'.tr()), findsOneWidget);
    expect(find.text('logging.cheatIntensity.heavy'.tr()), findsOneWidget);

    await tester.tap(find.text('logging.cheatIntensity.heavy'.tr()));
    await tester.pumpAndSettle();

    expect(
      container.read(cheatIntensityProvider),
      CheatIntensity.heavy,
      reason: 'the choice must outlive the sheet, not sit in its State',
    );
    // Collapsed again, now reading back the new value.
    expect(find.text('logging.cheatIntensity.heavy'.tr()), findsOneWidget);
    expect(find.text('logging.cheatIntensity.light'.tr()), findsNothing);
  });

  testWidgets('the sheet still returns the picked mode', (tester) async {
    await openSheet(tester, MealLogMode.cheat);

    await tester.tap(find.text('logging.modeSelector.normal'.tr()));
    await tester.pumpAndSettle();

    expect(find.text('logging.modeSelector.title'.tr()), findsNothing);
  });
}
