import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/data/barcode_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/barcode_manual_input.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/barcode_scanner_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/frame/barcode_frame_notice.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_camera_stage.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// "No product found" used to collapse the sheet into a short white panel —
/// red alert puck, the raw code, and four stacked full-width actions, one of
/// them "Scan again" for a scanner that had never stopped.
///
/// The miss now rides inside the camera frame, so the two things this file
/// guards are: the sheet does NOT change height when a lookup fails, and the
/// scanner really is still live behind the message (which is what earns the
/// dropped "Scan again" button).
class _FakeApiClient extends ApiClient {
  final List<String> paths = [];
  FutureOr<Object?> Function(String path)? handler;

  @override
  Future<T> get<T>(String path) async {
    paths.add(path);
    return (await handler!(path)) as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    paths.add(path);
    return (await handler!(path)) as T;
  }
}

/// Stands in for the camera plugin: no channels, a flat preview, and a stream
/// the test can push decodes into.
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
  Future<Set<CameraLensType>> getSupportedLenses() async => {
    CameraLensType.any,
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeApiClient api;
  late _FakeScannerPlatform scanner;
  late ProviderContainer container;

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  setUp(() {
    api = _FakeApiClient();
    api.handler =
        (_) => throw ApiError('BARCODE_NOT_FOUND', 404, false, 'not found');
    scanner = _FakeScannerPlatform();
    MobileScannerPlatform.instance = scanner;
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
    addTearDown(scanner.barcodes.close);
    // barcodeFlowProvider is autoDispose — hold a listener so the state the
    // widget builds from survives the test's own reads.
    container.listen(barcodeFlowProvider, (_, __) {});
  });

  Future<void> pumpSheet(WidgetTester tester, {double textScale = 1.0}) async {
    await loadAppFonts();
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
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
              // The host sheet's own shape: a bottom-anchored column that lets
              // the branch size itself, which is exactly what must not move.
              home: Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(textScale)),
                  child: Material(
                    color: Colors.transparent,
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: SizedBox(
                        width: 320,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: BarcodeScannerSheet(
                                userId: 'user-1',
                                date: '2026-09-01',
                                onScanLabelInstead: () {},
                                onFallbackToText: () {},
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  double sheetHeight(WidgetTester tester) =>
      tester.getSize(find.byType(BarcodeScannerSheet)).height;

  /// A decode arriving from the camera, the way the plugin delivers one.
  Future<void> decode(WidgetTester tester, String raw) async {
    scanner.barcodes.add(BarcodeCapture(barcodes: [Barcode(rawValue: raw)]));
    await tester.pumpAndSettle();
  }

  testWidgets('a miss keeps the frame, and the sheet keeps its height', (
    tester,
  ) async {
    await pumpSheet(tester);
    final scanning = sheetHeight(tester);

    await decode(tester, '8934563138162');

    expect(
      container.read(barcodeFlowProvider).errorKey,
      'logging.barcode.error.notFound',
    );
    // Measured: 448.0 both sides (8 + a 288x384 stage + 4 + a 44pt link + 8).
    expect(sheetHeight(tester), closeTo(scanning, 0.01));
    // The camera is still the screen, with the miss over it and the code kept
    // for the manual path.
    expect(find.byType(ScanCameraStage), findsOneWidget);
    expect(find.text('logging.barcode.error.notFound'.tr()), findsOneWidget);
    expect(find.text('8934563138162'), findsOneWidget);
  });

  for (final scale in const [1.0, 1.3]) {
    testWidgets('the miss fits inside the frame at ${scale}x text', (
      tester,
    ) async {
      await pumpSheet(tester, textScale: scale);
      await decode(tester, '8934563138162');

      // The capsule grows upward from the control row; nothing it carries may
      // spill out of the top of the stage that clips it.
      final stage = tester.getRect(find.byType(ScanCameraStage));
      final notice = tester.getRect(find.byType(BarcodeFrameNotice));
      expect(notice.top, greaterThanOrEqualTo(stage.top));
      expect(notice.bottom, lessThanOrEqualTo(stage.bottom));
    });
  }

  testWidgets('the scanner IS the retry — no "Scan again", one manual link', (
    tester,
  ) async {
    await pumpSheet(tester);
    await decode(tester, '8934563138162');

    expect(find.text('logging.barcode.scanAgain'.tr()), findsNothing);
    // The escape hatch below the frame, exactly once — it used to print twice
    // on the state where it matters most.
    expect(find.text('logging.barcode.manualEntry'.tr()), findsOneWidget);
    // Quiet links, not a stack of full-width pills.
    expect(find.text('logging.scan.tryLabelInstead'.tr()), findsOneWidget);
    expect(find.text('logging.barcode.logByText'.tr()), findsOneWidget);

    // And the scanner really is armed: the next package searches without the
    // user pressing anything.
    await decode(tester, '4008400402222');
    expect(api.paths, [
      '/api/v1/barcode/search?code=8934563138162',
      '/api/v1/barcode/search?code=4008400402222',
    ]);
  });

  testWidgets('a typed code that misses keeps its keyboard', (tester) async {
    await pumpSheet(tester);

    await tester.tap(find.text('logging.barcode.manualEntry'.tr()));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '8934563138162');
    await tester.tap(find.text('logging.barcode.lookUp'.tr()));
    await tester.pumpAndSettle();

    // Someone who reached for the keyboard has usually already told us the
    // camera is no use to them — a miss must not drop them into a viewport.
    expect(find.byType(BarcodeManualInput), findsOneWidget);
    expect(find.byType(ScanCameraStage), findsNothing);
    expect(find.text('logging.barcode.error.notFound'.tr()), findsOneWidget);
  });

  testWidgets('the lookup runs over the picture, not in place of it', (
    tester,
  ) async {
    final gate = Completer<Map<String, dynamic>>();
    api.handler = (_) => gate.future;

    await pumpSheet(tester);
    final scanning = sheetHeight(tester);

    // Driven from the controller, not the camera stream: the lookup is held
    // open here, and pumpAndSettle would wait on it forever.
    unawaited(
      container.read(barcodeFlowProvider.notifier).search('8934563138162'),
    );
    await tester.pump();

    expect(
      container.read(barcodeFlowProvider).phase,
      BarcodeFlowPhase.searching,
    );
    expect(find.byType(ScanCameraStage), findsOneWidget);
    expect(find.text('logging.barcode.searching'.tr()), findsOneWidget);
    expect(sheetHeight(tester), closeTo(scanning, 0.01));

    gate.complete(<String, dynamic>{
      'product': const <String, dynamic>{'barcode': '8934563138162'},
    });
    await tester.pumpAndSettle();
  });
}
