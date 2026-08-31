import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/states/empty_state.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

/// Black is the CTA variant, reserved for auth and paywall. "Log a meal" is an
/// ordinary in-app primary and must wear the beige `btnPrimarySoft` + ink wash
/// like every other one.
Widget _app() => EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: const Scaffold(body: EmptyState()),
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

  testWidgets('the "Log a meal" CTA is the beige in-app primary, not black',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final button = tester.widget<KalloButton>(find.byType(KalloButton));
    expect(button.variant, KalloButtonVariant.primary);

    final container = tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byType(KalloButton),
        matching: find.byType(AnimatedContainer),
      ),
    );
    final fill = (container.decoration! as BoxDecoration).color;
    expect(fill, KalloColors.btnPrimarySoft);
    expect(fill, isNot(KalloColors.btnPrimary),
        reason: 'black is reserved for auth/paywall CTAs');
  });
}
