import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_row.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/feature_lock.dart';
import 'package:kallo_mobile/shared/widgets/badges/premium_chip.dart';

import '../../l10n_test_loader.dart';

/// The Premium markers on the mode sheet: shown only for a mode the plan
/// lacks, and a tap on a marked mode goes to the paywall instead of picking it.
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

  /// Opens the sheet with [locked] features marked, and records what the
  /// sheet resolved with into [picked].
  Future<void> openSheet(
    WidgetTester tester, {
    required Set<String> locked,
    required List<MealLogMode?> picked,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder:
              (_, _) => Scaffold(
                body: Builder(
                  builder:
                      (c) => TextButton(
                        onPressed:
                            () async => picked.add(
                              await showMealModeSheet(
                                c,
                                current: MealLogMode.manual,
                              ),
                            ),
                        child: const Text('open'),
                      ),
                ),
              ),
        ),
        GoRoute(
          path: '/paywall',
          builder: (_, _) => const Scaffold(body: Text('paywall-route')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          for (final feature in [
            PremiumFeature.aiAnalysis,
            PremiumFeature.cheatMeal,
          ])
            premiumLockProvider(
              feature,
            ).overrideWithValue(locked.contains(feature)),
        ],
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder:
                (context) => MaterialApp.router(
                  routerConfig: router,
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  Finder chipOn(MealLogMode mode) => find.descendant(
    of: find.byWidgetPredicate((w) => w is MealModeRow && w.mode == mode),
    matching: find.byType(PremiumChip),
  );

  testWidgets('free user: Instant and Cheat carry the chip, Manual does not', (
    tester,
  ) async {
    await openSheet(
      tester,
      locked: {PremiumFeature.aiAnalysis, PremiumFeature.cheatMeal},
      picked: [],
    );

    expect(chipOn(MealLogMode.normal), findsOneWidget);
    expect(chipOn(MealLogMode.cheat), findsOneWidget);
    expect(chipOn(MealLogMode.manual), findsNothing);
  });

  testWidgets('the chip sits at the row\'s right end, left of the check', (
    tester,
  ) async {
    await openSheet(
      tester,
      locked: {PremiumFeature.aiAnalysis},
      picked: [],
    );

    final row = tester.getRect(
      find.byWidgetPredicate(
        (w) => w is MealModeRow && w.mode == MealLogMode.normal,
      ),
    );
    final chip = tester.getRect(chipOn(MealLogMode.normal));
    // Right-aligned: nearer the row's right edge than its centre.
    expect(chip.right, greaterThan(row.center.dx + row.width / 4));
    // Vertically centred on the row.
    expect(chip.center.dy, closeTo(row.center.dy, 1));
  });

  testWidgets('premium user: no chips', (tester) async {
    await openSheet(tester, locked: {}, picked: []);

    expect(find.byType(PremiumChip), findsNothing);
  });

  testWidgets('a locked mode opens the paywall instead of being picked', (
    tester,
  ) async {
    final picked = <MealLogMode?>[];
    await openSheet(
      tester,
      locked: {PremiumFeature.aiAnalysis},
      picked: picked,
    );

    await tester.tap(find.text('logging.modeSelector.normal'.tr()));
    await tester.pumpAndSettle();

    expect(find.text('paywall-route'), findsOneWidget);
    expect(picked, isEmpty);
  });

  testWidgets('an unlocked mode is still picked normally', (tester) async {
    final picked = <MealLogMode?>[];
    await openSheet(
      tester,
      locked: {PremiumFeature.cheatMeal},
      picked: picked,
    );

    await tester.tap(find.text('logging.modeSelector.normal'.tr()));
    await tester.pumpAndSettle();

    expect(find.text('paywall-route'), findsNothing);
    expect(picked, [MealLogMode.normal]);
  });
}
