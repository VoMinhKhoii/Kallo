import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/barcode_scanner_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/feed_sheets.dart';

import '../../../l10n_test_loader.dart';

/// The composer's scan icon means two different things depending on the mode
/// it is tapped in, and main only ever had one of them.
///
/// A scanned PICK rides the composer's submit as a reference. Cheat submits
/// carry no references — `planComposerSubmit` drops them and sends the sentence
/// as prose — so a pick made in cheat mode would come back as an ESTIMATE of
/// the words "TH true milk Sữa tươi (180g)", silently throwing away the exact
/// product the user had just scanned. Cheat therefore keeps the one-shot log,
/// which is what the icon did in every mode before picks existed.
class _FakeScannerPlatform extends MobileScannerPlatform {
  final StreamController<BarcodeCapture?> barcodes =
      StreamController<BarcodeCapture?>.broadcast();

  @override
  Stream<BarcodeCapture?> get barcodesStream => barcodes.stream;

  @override
  Stream<TorchState> get torchStateStream => const Stream.empty();

  @override
  Stream<double> get zoomScaleStateStream => const Stream.empty();

  @override
  Widget buildCameraView() => const ColoredBox(color: Color(0xFF000000));

  @override
  Future<MobileScannerViewAttributes> start(StartOptions startOptions) async =>
      const MobileScannerViewAttributes(
        cameraDirection: CameraFacing.back,
        currentTorchMode: TorchState.unavailable,
        size: Size(640, 480),
      );

  @override
  Future<void> stop() async {}

  @override
  Future<void> pause() async {}

  @override
  Future<void> dispose() async {}

  @override
  Future<void> updateScanWindow(Rect? window) async {}

  @override
  Future<Set<CameraLensType>> getSupportedLenses() async => {CameraLensType.any};
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeScannerPlatform scanner;
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
    scanner = _FakeScannerPlatform();
    MobileScannerPlatform.instance = scanner;
    composer = MentionTextEditingController();
    addTearDown(scanner.barcodes.close);
    addTearDown(composer.dispose);
  });

  /// Tap the composer's scan icon in [mode] and hand back the branch it opened.
  Future<BarcodeScannerSheet> tapScanIcon(
    WidgetTester tester,
    MealLogMode mode,
  ) async {
    late BuildContext hostContext;
    await tester.pumpWidget(
      ProviderScope(
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

    return tester.widget<BarcodeScannerSheet>(find.byType(BarcodeScannerSheet));
  }

  testWidgets('normal mode scans a PICK into the sentence', (tester) async {
    final branch = await tapScanIcon(tester, MealLogMode.normal);
    expect(branch.asPick, isTrue);
  });

  testWidgets('cheat mode logs the product on the spot instead', (
    tester,
  ) async {
    final branch = await tapScanIcon(tester, MealLogMode.cheat);
    expect(
      branch.asPick,
      isFalse,
      reason: 'a pick cannot ride a cheat submit — it would arrive as prose',
    );
  });
}
