import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_intensity_group.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet_sub_header.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

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
    // A real phone, not the 800x600 default: the back affordance's copy
    // depends on the width it actually gets.
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
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

  testWidgets('intensity opens a second level INSIDE the one sheet', (
    tester,
  ) async {
    await openSheet(tester, MealLogMode.cheat);
    final surfaces = find.byType(KalloSheetSurface);
    expect(surfaces, findsOneWidget);

    await tester.tap(find.text('logging.cheatIntensity.title'.tr()));
    await tester.pumpAndSettle();

    // Still ONE surface: the page swapped, a second modal did not stack.
    expect(
      surfaces,
      findsOneWidget,
      reason: 'the level must push within the sheet, not open another sheet',
    );

    // The second-level chrome: back reads the parent's title, the page's own
    // title is centred, and the card is explained by a muted line.
    expect(find.byType(KalloSheetSubHeader), findsOneWidget);
    // The mode sheet's title is a QUESTION ("How do you want to log?") and is
    // far too long to sit beside a centred title, so the back group falls back
    // to the generic word — iOS's own rule — rather than ellipsising to
    // "How do you wa…", which would name nothing.
    expect(find.text('common.back'.tr()), findsOneWidget);
    expect(find.text('logging.cheatIntensity.title'.tr()), findsOneWidget);
    expect(find.text('logging.cheatIntensity.helper'.tr()), findsOneWidget);
    for (final level in CheatIntensity.values) {
      expect(find.text(cheatIntensityLabel(level)), findsOneWidget);
    }
    // The mode list is gone while the page is up.
    expect(find.text('logging.modeSelector.normal'.tr()), findsNothing);

    final header = tester.getRect(find.byType(KalloSheetSubHeader));
    final title = tester.getRect(
      find.text('logging.cheatIntensity.title'.tr()),
    );
    expect(
      title.center.dx,
      closeTo(header.center.dx, 1.0),
      reason: 'the page title is centred on the sheet, not on what is left',
    );
  });

  testWidgets('back returns to the modes with the sheet still open', (
    tester,
  ) async {
    final container = await openSheet(tester, MealLogMode.cheat);

    await tester.tap(find.text('logging.cheatIntensity.title'.tr()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('common.back'.tr()));
    await tester.pumpAndSettle();

    expect(find.byType(KalloSheetSubHeader), findsNothing);
    expect(find.text('logging.modeSelector.normal'.tr()), findsOneWidget);
    expect(find.byType(KalloSheetSurface), findsOneWidget);
    expect(
      container.read(cheatIntensityProvider),
      CheatIntensity.medium,
      reason: 'backing out of the page changes nothing',
    );
  });

  testWidgets('the chosen mode is marked by a tick, with no fill behind it', (
    tester,
  ) async {
    await openSheet(tester, MealLogMode.cheat);

    expect(find.byIcon(LucideIcons.check300), findsOneWidget);
    // The wash this row used to carry was the same colour ListRow paints
    // while pressed, so a selected row and a pressed one were one picture.
    final fills = find.byWidgetPredicate(
      (w) => w is ColoredBox && w.color == KalloColors.hover,
    );
    expect(
      fills,
      findsNothing,
      reason: 'selection is the tick alone — no beige row wash',
    );
  });
}
