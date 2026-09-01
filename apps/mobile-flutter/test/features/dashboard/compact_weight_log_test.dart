import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/widgets/weight/compact_weight_log.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_amount_field.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../l10n_test_loader.dart';

Widget _wrap() => ProviderScope(
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
          body: CompactWeightLog(
            currentWeight: 68,
            todayWeight: null,
            todayDate: '2026-08-31',
            args: (userId: 'u1', date: '2026-08-31'),
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

  testWidgets('Save is the in-app primary: beige full-round pill, ink label', (
    tester,
  ) async {
    // The weight sheet missed the umber retirement on the first native pass —
    // its Save shipped umber/white on the old radius (user report, 2026-08-31).
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    final saveLabel = find.text('Save');
    expect(saveLabel, findsOneWidget);

    final button = tester.widget<Container>(
      find
          .ancestor(of: saveLabel, matching: find.byType(Container))
          .first,
    );
    final decoration = button.decoration! as BoxDecoration;
    expect(decoration.color, KalloColors.btnPrimarySoft,
        reason: 'in-app primary fill is the beige wash, not umber');
    expect(
      decoration.borderRadius,
      BorderRadius.circular(KalloRadii.button),
      reason: 'full-width buttons are fully rounded',
    );
    expect(
      tester.widget<Text>(saveLabel).style?.color,
      KalloColors.text,
      reason: 'beige buttons carry ink labels',
    );
  });

  testWidgets('the kg field is the app-wide full-round 52pt pill', (
    tester,
  ) async {
    // The native pass converted every other full-width field and missed this
    // one: it shipped on KalloRadii.xl (14) at ~48pt, a rounded square among
    // pills (user report, 2026-09-01).
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    final field = find.byType(WeightAmountField);
    expect(field, findsOneWidget);
    expect(
      tester.getSize(field).height,
      greaterThanOrEqualTo(52),
      reason: 'full-width fields are 52pt tall',
    );

    final decoration = tester.widget<TextField>(
      find.descendant(of: field, matching: find.byType(TextField)),
    ).decoration!;
    for (final border in [
      decoration.border,
      decoration.enabledBorder,
      decoration.focusedBorder,
      decoration.disabledBorder,
    ]) {
      expect(
        (border! as OutlineInputBorder).borderRadius,
        BorderRadius.circular(KalloRadii.input),
        reason: 'every state of the pill carries the full-round radius',
      );
    }
    // 18 is the shared field's inset — where text starts inside a radius-26
    // pill. A smaller one lets the first glyph ride the curve.
    expect(
      (decoration.contentPadding! as EdgeInsets).left,
      18,
    );
    // Still the track fill, which is the whole reason this field is
    // hand-decorated rather than a KalloTextField.
    expect(decoration.fillColor, KalloColors.track);
  });
}
