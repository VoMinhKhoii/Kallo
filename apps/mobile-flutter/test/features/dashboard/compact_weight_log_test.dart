import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/widgets/weight/compact_weight_log.dart';
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
}
