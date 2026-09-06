import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/composer_card_surface.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input_controls.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The composer card's two ends.
///
/// They are NOT the same number and must not be: 8pt of padding above the text
/// and 10 under the send circle read as equal, because `dashBody` (16 × 1.3)
/// hangs ~2.4pt of half-leading above its glyphs while the circle's edge is
/// its edge. Setting both to 8 (or both to 12) tips the card visibly.
const _topToText = 8.0;
const _sendToBottom = 10.0;

/// [ComposerCardSurface] draws a 1pt border (transparent until the field takes
/// focus) and a border insets what it wraps, so both numbers are measured from
/// INSIDE it — the padding under test is `LoggingSpacing.composer`, not the
/// border the card happens to carry on both edges alike.
const _cardBorder = 1.0;

Widget _host(MealInputController controller) => EasyLocalization(
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
          child: Align(
            alignment: Alignment.topCenter,
            child: MealInput(controller: controller, onSubmit: (_) {}),
          ),
        ),
      ),
    ),
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
    await loadAppFonts();
  });

  testWidgets('the card pads 8 over the text and 10 under the send circle', (
    tester,
  ) async {
    await tester.pumpWidget(_host(MealInputController()));
    await tester.pumpAndSettle();

    // The card itself — the surface that paints the border and the fill.
    final card = tester.getRect(
      find
          .descendant(
            of: find.byType(ComposerCardSurface),
            matching: find.byType(Container),
          )
          .first,
    );
    // The TEXT, not the field: the TextField's box starts at the card's top
    // edge (composer.top is 0) and carries the 8 as its own contentPadding.
    final text = tester.getRect(find.byType(EditableText));
    // The 32pt circle, not its 44pt tap target — the target's extra 6 all
    // round is half of what makes the bottom inset 10 rather than 4.
    final sendCircle = tester.getRect(
      find
          .descendant(
            of: find.byType(ComposerActionButton),
            matching: find.byType(Container),
          )
          .first,
    );

    expect(text.top - (card.top + _cardBorder), closeTo(_topToText, 0.01));
    expect(
      (card.bottom - _cardBorder) - sendCircle.bottom,
      closeTo(_sendToBottom, 0.01),
    );
  });
}
