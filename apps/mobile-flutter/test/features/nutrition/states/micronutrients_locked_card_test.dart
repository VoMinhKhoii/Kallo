// The locked micronutrients card: the Nutrition sloth's `locked` pose on the
// shared surface state, the Premium copy, and one "Upgrade" that opens the
// paywall.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/nutrition/widgets/states/micronutrients_locked_card.dart';
import 'package:kallo_mobile/shared/data/surface_cast.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';

import '../../../l10n_test_loader.dart';

Widget _app(GoRouter router) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp.router(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          routerConfig: router,
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

  testWidgets('shows the sloth locked pose, the Premium copy and Upgrade, '
      'and Upgrade opens the paywall', (tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder:
              (_, _) => const Scaffold(
                body: SingleChildScrollView(child: MicronutrientsLockedCard()),
              ),
        ),
        GoRoute(
          path: '/paywall',
          builder: (_, _) => const Scaffold(body: Text('paywall')),
        ),
      ],
    );
    await tester.pumpWidget(_app(router));
    await tester.pumpAndSettle();

    final state = tester.widget<KalloSurfaceState>(
      find.byType(KalloSurfaceState),
    );
    expect(state.area, SurfaceArea.nutrition);
    expect(state.kind, SurfaceKind.locked);
    expect(find.text('Micronutrients are in Premium plan'), findsOneWidget);
    expect(
      find.text('Vitamins, minerals and fiber, tracked against your targets.'),
      findsOneWidget,
    );

    final upgrade = find.widgetWithText(KalloButton, 'Upgrade');
    expect(upgrade, findsOneWidget);
    expect(tester.widget<KalloButton>(upgrade).variant, KalloButtonVariant.cta);

    await tester.tap(upgrade);
    await tester.pumpAndSettle();
    expect(find.text('paywall'), findsOneWidget);
  });
}
