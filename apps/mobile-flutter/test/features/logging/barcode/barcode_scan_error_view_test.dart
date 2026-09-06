import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/frame/barcode_scan_error_view.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/frame/barcode_scan_frame_painter.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_camera_stage.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_error_card.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// A camera that cannot run used to render INSIDE the 3:4 stage, through
/// `MobileScanner.errorBuilder` — so the reticle and the hint band went on
/// painting over the message. The failure now replaces the stage with the same
/// [ScanErrorCard] the label branch shows, and these tests hold that shape.
///
/// The view is rendered on its own here: no `MobileScanner`, no controller, no
/// platform channel — which is the point of it being a plain widget over an
/// exception rather than a builder buried in the scanner.
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

  Future<void> pumpView(
    WidgetTester tester,
    MobileScannerErrorCode code, {
    VoidCallback? onEnterManually,
  }) async {
    await loadAppFonts();
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Material(
              color: Colors.transparent,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: SizedBox(
                  width: 320,
                  child: BarcodeScanErrorView(
                    error: MobileScannerException(errorCode: code),
                    onEnterManually: onEnterManually ?? () {},
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

  final reticle = find.byWidgetPredicate(
    (widget) => widget is CustomPaint && widget.painter is ScanFramePainter,
  );

  testWidgets('permission denied gets the settings copy, in the one card', (
    tester,
  ) async {
    await pumpView(tester, MobileScannerErrorCode.permissionDenied);

    expect(find.byType(ScanErrorCard), findsOneWidget);
    expect(find.text('logging.barcode.cameraDenied'.tr()), findsOneWidget);
    expect(find.text('logging.barcode.cameraError'.tr()), findsNothing);

    // The stage is REPLACED, not painted over: no dark viewport behind the
    // message, and no scan frame drawn across it.
    expect(find.byType(ScanCameraStage), findsNothing);
    expect(reticle, findsNothing);
  });

  testWidgets('any other failure gets the generic camera copy', (tester) async {
    await pumpView(tester, MobileScannerErrorCode.genericError);

    expect(find.byType(ScanErrorCard), findsOneWidget);
    expect(find.text('logging.barcode.cameraError'.tr()), findsOneWidget);
    expect(find.text('logging.barcode.cameraDenied'.tr()), findsNothing);
    expect(find.byType(ScanCameraStage), findsNothing);
    expect(reticle, findsNothing);
  });

  testWidgets('the primary action is the manual-entry escape hatch', (
    tester,
  ) async {
    var entered = 0;
    await pumpView(
      tester,
      MobileScannerErrorCode.permissionDenied,
      onEnterManually: () => entered++,
    );

    // Exactly once — the quiet link below the frame belongs to the live
    // viewport, which this view has replaced.
    expect(find.text('logging.barcode.manualEntry'.tr()), findsOneWidget);
    await tester.tap(find.text('logging.barcode.manualEntry'.tr()));
    expect(entered, 1);
  });
}
