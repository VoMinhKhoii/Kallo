import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// A camera-less `mobile_scanner`: starts at once, paints black, and decodes
/// whatever a test adds to [barcodes].
class FakeScannerPlatform extends MobileScannerPlatform {
  final StreamController<BarcodeCapture?> barcodes =
      StreamController<BarcodeCapture?>.broadcast();

  /// Decode [code] as if it had just crossed the scan window.
  void detect(String code) => barcodes.add(
    BarcodeCapture(
      barcodes: [Barcode(rawValue: code, format: BarcodeFormat.ean13)],
    ),
  );

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
