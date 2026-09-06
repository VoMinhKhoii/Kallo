import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_added_list.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_gram_field.dart';
import 'package:kallo_mobile/models/nutrition/ingredient.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The picked-ingredient rows: the gram field's anatomy and what the row's
/// figure MEANS.
///
/// The kcal line is the subtle one. A search result reads "130 kcal/100g"; the
/// row it becomes used to read "234 kcal" — the same-looking figure silently
/// switching from a density to a scaled total the moment you tapped it, with
/// the grams that scaled it sitting right beside it. Both ends now state the
/// density, so the number means one thing across the sheet.
const _rice = IngredientSearchResult(
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  state: 'cooked',
  per100g: IngredientMacrosPer100g(caloriesKcal: 130, proteinG: 2.7),
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
    await loadAppFonts();
  });

  Future<void> pumpList(WidgetTester tester, {double? grams}) async {
    await tester.pumpWidget(
      EasyLocalization(
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
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: ManualAddedList(
                  items: [
                    ManualLogItem(id: 'a', ingredient: _rice, grams: grams),
                  ],
                  disabled: false,
                  onGramsChange: (_, __) {},
                  onRemove: (_) {},
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('the gram value is optically centred in its field', (
    tester,
  ) async {
    await pumpList(tester, grams: 180);

    final field = tester.getRect(find.byType(ManualGramField));
    final text = tester.getRect(find.byType(EditableText));
    expect(
      (text.center.dy - field.center.dy).abs(),
      lessThanOrEqualTo(0.5),
      reason: 'the number sits off-centre inside the squircle',
    );
  });

  testWidgets('the gram field is a comfortable tap-and-read size', (
    tester,
  ) async {
    await pumpList(tester, grams: 180);

    final field = tester.getRect(find.byType(ManualGramField));
    expect(
      field.height,
      greaterThanOrEqualTo(44),
      reason: '36pt was a mini field on a row you are meant to type into',
    );
  });

  testWidgets('four digits and the unit fit without overflowing', (
    tester,
  ) async {
    await pumpList(tester, grams: 9999);
    // A RenderFlex/paint overflow fails the test by itself; this also asserts
    // the glyphs are not silently clipped by the field's own box.
    final field = tester.getRect(find.byType(ManualGramField));
    final text = tester.getRect(find.byType(EditableText));
    expect(text.width, lessThanOrEqualTo(field.width));
  });

  testWidgets('the remove X keeps the row trailing margin', (tester) async {
    await pumpList(tester, grams: 180);

    final card = tester.getRect(find.byType(ManualAddedList));
    final glyph = tester.getRect(find.byIcon(LucideIcons.x300));
    final button = tester.getRect(find.byType(IconButton));

    // The glyph's box ends on the card's inner margin — the SAME line the name
    // starts from on the left (1pt border + 14pt padding) — rather than 27pt
    // inside it, which read as floating instead of as the row's right margin.
    final name = tester.getRect(find.text('Cơm trắng'));
    expect(card.right - glyph.right, name.left - card.left);
    expect(card.right - glyph.right, 15);
    // The 44pt target is kept by extending INWARD from the glyph.
    expect(button.width, KalloIcons.hit);
    expect(button.height, KalloIcons.hit);
    expect(button.right, glyph.right);
    // Which leaves real space between the gram field and the mark.
    final field = tester.getRect(find.byType(ManualGramField));
    expect(glyph.left - field.right, greaterThanOrEqualTo(8));
  });

  testWidgets('the row states the energy density, not a bare figure', (
    tester,
  ) async {
    await pumpList(tester, grams: 180);

    expect(
      find.text('130 ${'logging.manualLogging.kcalPer100g'.tr()}'),
      findsOneWidget,
      reason: 'the same basis the search result stated',
    );
    // The old scaled total (130 × 1.8 = 234) must not be what the row shows.
    expect(find.text('234 ${'logging.manualLogging.kcal'.tr()}'), findsNothing);
  });

  testWidgets('the density shows before any grams are entered', (
    tester,
  ) async {
    await pumpList(tester);

    expect(
      find.text('130 ${'logging.manualLogging.kcalPer100g'.tr()}'),
      findsOneWidget,
      reason: 'density is a property of the food, not of the amount',
    );
    expect(find.text('—'), findsNothing);
  });
}
