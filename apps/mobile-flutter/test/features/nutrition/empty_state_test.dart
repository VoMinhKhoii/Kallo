import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/states/empty_state.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

/// The one action under a surface state wears the black `cta` variant — ink
/// fill, white label — like auth and the paywall. "Log a meal" on the empty
/// nutrition page is that action, so it must not fall back to the beige
/// in-app primary.
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

  testWidgets('the "Log a meal" action is the black ink button',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final button = tester.widget<KalloButton>(find.byType(KalloButton));
    expect(button.variant, KalloButtonVariant.cta);

    final container = tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byType(KalloButton),
        matching: find.byType(AnimatedContainer),
      ),
    );
    final fill = (container.decoration! as BoxDecoration).color;
    expect(fill, KalloColors.btnPrimary);
    expect(fill, isNot(KalloColors.btnPrimarySoft),
        reason: 'surface-state actions are ink, not the beige primary');
  });
}
