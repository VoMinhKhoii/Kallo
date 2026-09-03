import 'package:mobile_scanner/mobile_scanner.dart';

/// Owns the scanner's controller so the camera runs during the scanning phase
/// and nowhere else — it must not keep streaming behind the quantity step.
class BarcodeCameraSession {
  /// Restrict decoding to retail formats: faster, and QR codes printed next to
  /// the nutrition panel never hijack a scan.
  static final _formats = [
    BarcodeFormat.ean13,
    BarcodeFormat.ean8,
    BarcodeFormat.upcA,
    BarcodeFormat.upcE,
    BarcodeFormat.code128,
  ];

  MobileScannerController? _controller;

  /// Single-flight guard: mobile_scanner keeps emitting detections for frames
  /// already in the pipeline after the first hit; only the first may search.
  bool _handledDetection = false;

  /// True between [ensure] and [release].
  bool get isRunning => _controller != null;

  /// Built lazily, when the scanning phase mounts.
  MobileScannerController ensure() =>
      _controller ??= MobileScannerController(
        formats: _formats,
        detectionSpeed: DetectionSpeed.noDuplicates,
        // Ask for the standard 1x lens by name. The default (`any`) makes the
        // plugin's iOS selector discover `.builtInTripleCamera` first
        // (`MobileScannerCameraSelector.swift`, the `case nil` arm: triple →
        // dual → wide angle), and a virtual multi-camera device opens at its
        // WIDEST constituent — so the preview came up at 0.5x on every Pro
        // phone. `normal` maps to `.builtInWideAngleCamera`, the 1x lens.
        // Not `initialZoom`: zooming the ultra-wide back to 1x would crop a
        // sensor that is already the wrong one for reading a barcode.
        lensType: CameraLensType.normal,
      );

  /// Re-arm the decode guard — scanning has (re)started.
  void arm() => _handledDetection = false;

  void release() {
    _controller?.dispose();
    _controller = null;
  }

  /// The first unclaimed payload of [capture], or null when there is none.
  String? claimDetection(BarcodeCapture capture) {
    if (_handledDetection) return null;
    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return null;
    _handledDetection = true;
    return raw;
  }
}
