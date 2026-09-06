import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet_header.dart';
import 'package:kallo_mobile/shell/nav/add_sheet.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../l10n_test_loader.dart';

/// The close X's GLYPH starts on exactly the line the sheet's own content
/// starts on — measured against that content, never against a constant.
///
/// The previous assertion compared the glyph to a hardcoded 16 while rendering
/// the header STANDALONE in an unpadded surface, which is the one arrangement
/// where 16 happens to be right. Every sheet that pads its own body — the Add
/// sheet, the mode sheet, the weight sheet — stacked the header's own 16 on
/// top of the surface's, putting the X at 32: a full inset right of the row
/// icons directly beneath it, which is what the device screenshot showed. The
/// test was green throughout, because it was answering a different question.
///
/// So these open the REAL sheets and compare two MEASURED rects.
Widget _wrap(Widget home) => ProviderScope(
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
        home: Scaffold(body: home),
      ),
    ),
  ),
);

/// Opens a sheet from a tap, the way the app does.
Widget _opener(void Function(BuildContext, WidgetRef) open) => Consumer(
  builder: (context, ref, _) => TextButton(
    onPressed: () => open(context, ref),
    child: const Text('open'),
  ),
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

  void expectAligned(
    WidgetTester tester, {
    required Finder content,
    required String sheet,
  }) {
    final glyph = tester.getRect(find.byIcon(LucideIcons.x300));
    final body = tester.getRect(content);
    expect(
      glyph.left,
      closeTo(body.left, 0.5),
      reason:
          'on the $sheet the X glyph starts at ${glyph.left} while the '
          'content column starts at ${body.left} — the close affordance is '
          'not on the sheet\'s own line',
    );

    // The 44pt target is kept by growing from the glyph, never by pushing it in.
    final target = tester.getSize(find.byType(IconButton));
    expect(target.width, greaterThanOrEqualTo(44));
    expect(target.height, greaterThanOrEqualTo(44));
  }

  testWidgets('Add sheet: the X sits on the row icons', (tester) async {
    await tester.pumpWidget(_wrap(_opener(showAddSheet)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expectAligned(
      tester,
      content: find.byIcon(LucideIcons.utensils300),
      sheet: 'Add sheet',
    );
  });

  testWidgets('meal-mode sheet: the X sits on the mode icons', (tester) async {
    await tester.pumpWidget(
      _wrap(
        _opener(
          (context, ref) =>
              showMealModeSheet(context, current: MealLogMode.normal),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expectAligned(
      tester,
      content: find.byIcon(mealModeIcon(MealLogMode.normal)),
      sheet: 'meal-mode sheet',
    );
  });

  // The two arrangements every sheet in the app is one of. The header can only
  // land on the content line in BOTH if it inherits the surface's inset rather
  // than adding a fixed one, so these pin the rule itself: the padded case
  // covers the Add / mode / weight / quick-log family, the bare case covers
  // the full-bleed scan sheet, whose body steps inset themselves.
  for (final inset in <double?>[null, KalloSpacing.sp4, KalloSpacing.sp5]) {
    testWidgets('a surface padded at $inset keeps the X on its content line', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          KalloSheetSurface(
            padding: inset == null
                ? null
                : EdgeInsets.symmetric(horizontal: inset),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const KalloSheetHeader(title: 'Title'),
                Padding(
                  // A bare surface makes each body step supply the inset, the
                  // way the scan sheet's branches do.
                  padding: EdgeInsets.symmetric(
                    horizontal: inset == null ? KalloSpacing.sp4 : 0,
                  ),
                  child: ListRow(
                    icon: LucideIcons.utensils300,
                    label: 'A row',
                    onTap: () {},
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expectAligned(
        tester,
        content: find.byIcon(LucideIcons.utensils300),
        sheet: 'surface padded at $inset',
      );
    });
  }
}
