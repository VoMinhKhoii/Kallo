import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_screen.dart';
import 'package:kallo_mobile/features/logging/logic/composer/feed_sheets.dart';

import '../../../l10n_test_loader.dart';
import '../scan/fake_scanner_platform.dart';
import 'package:kallo_mobile/features/logging/logic/relog/scan_purpose.dart';

/// The composer's scan icon means two different things depending on the mode
/// it is tapped in, and main only ever had one of them.
///
/// A scanned PICK rides the composer's submit as a reference. Cheat submits
/// carry no references — `planComposerSubmit` drops them and sends the sentence
/// as prose — so a pick made in cheat mode would come back as an ESTIMATE of
/// the words "TH true milk Sữa tươi (180g)", silently throwing away the exact
/// product the user had just scanned. Cheat therefore keeps the one-shot log,
/// which is what the icon did in every mode before picks existed.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeScannerPlatform scanner;
  late MentionTextEditingController composer;

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  setUp(() {
    scanner = FakeScannerPlatform();
    MobileScannerPlatform.instance = scanner;
    composer = MentionTextEditingController();
    addTearDown(scanner.barcodes.close);
    addTearDown(composer.dispose);
  });

  /// Tap the composer's scan icon in [mode] and hand back the screen it opened.
  Future<ScanScreen> tapScanIcon(WidgetTester tester, MealLogMode mode) async {
    late BuildContext hostContext;
    await tester.pumpWidget(
      ProviderScope(
        child: EasyLocalization(
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
                  home: Builder(
                    builder: (context) {
                      hostContext = context;
                      return const Scaffold(body: SizedBox.expand());
                    },
                  ),
                ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final sheets = FeedSheets(
      context: hostContext,
      userId: 'user-1',
      date: '2026-09-09',
      mode: mode,
      onPersistentMode: (_) {},
      focusComposer: () {},
      composer: composer,
      onLogged: () {},
    );
    unawaited(sheets.openBarcodeFromComposer());
    await tester.pumpAndSettle();

    return tester.widget<ScanScreen>(find.byType(ScanScreen));
  }

  testWidgets('normal mode scans a PICK into the sentence', (tester) async {
    final branch = await tapScanIcon(tester, MealLogMode.normal);
    expect(branch.purpose, ScanPurpose.pick);
  });

  testWidgets('cheat mode logs the product on the spot instead', (
    tester,
  ) async {
    final branch = await tapScanIcon(tester, MealLogMode.cheat);
    expect(
      branch.purpose,
      ScanPurpose.log,
      reason: 'a pick cannot ride a cheat submit — it would arrive as prose',
    );
  });
}
