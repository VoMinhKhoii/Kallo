import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/composer_card_surface.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../l10n_test_loader.dart';

/// The composer card's rounded top corners stay round.
///
/// The app theme fills every TextField with the card colour, and the
/// composer's field sits flush with the card's top edge, inset 8 on the right
/// inside a 22 corner. Unclipped, that square fill showed past both top
/// corners: on the dark palette, a sharp notch on each.
const _backdrop = Color(0xFFFF0000);

final _boundary = GlobalKey();

Widget _host() => EasyLocalization(
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
          // The real theme — its `filled: true` is the half of the bug a
          // default ThemeData would hide.
          theme: KalloTheme.build(),
          home: RepaintBoundary(
            key: _boundary,
            child: Material(
              color: _backdrop,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: MealInput(
                    controller: MealInputController(),
                    onSubmit: (_) {},
                  ),
                ),
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
  });

  testWidgets('nothing inside the card paints past its top-right corner', (
    tester,
  ) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    final card = tester.getRect(
      find
          .descendant(
            of: find.byType(ComposerCardSurface),
            matching: find.byType(Container),
          )
          .first,
    );
    // Inside the field's fill box (8 in from the right, just under the card's
    // 1pt border) yet outside the 22 corner's arc: ~24 from its centre.
    final probe = Offset(card.right - 9.5, card.top + 1.5);

    final pixel = await tester.runAsync(() async {
      final boundary =
          _boundary.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      final image = await boundary.toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      final i = (probe.dy.floor() * image.width + probe.dx.floor()) * 4;
      return Color.fromARGB(
        bytes!.getUint8(i + 3),
        bytes.getUint8(i),
        bytes.getUint8(i + 1),
        bytes.getUint8(i + 2),
      );
    });

    expect(pixel, _backdrop);
  });
}
