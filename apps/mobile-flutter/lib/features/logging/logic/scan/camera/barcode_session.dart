import 'dart:async';

import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, visibleForTesting;
import 'package:mobile_scanner/mobile_scanner.dart';

import 'teardown.dart';

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

  /// True between [start] and [release].
  bool get isRunning => _controller != null;

  /// The scanner's controller while it runs; the camera layer mounts a
  /// scanner on it.
  MobileScannerController? get controller => _controller;

  /// Build the scanner (the camera layer mounts it) and arm its decode guard.
  /// Already running, it is only re-armed.
  void start() {
    _controller ??= _build();
    arm();
  }

  /// The lens the scanner asks for.
  ///
  /// iOS: the standard 1x lens by name. The default (`any`) makes the
  /// plugin's iOS selector discover `.builtInTripleCamera` first
  /// (`MobileScannerCameraSelector.swift`, the `case nil` arm: triple →
  /// dual → wide angle), and a virtual multi-camera device opens at its
  /// WIDEST constituent — so the preview came up at 0.5x on every Pro
  /// phone. `normal` maps to `.builtInWideAngleCamera`, the 1x lens.
  /// Not `initialZoom`: zooming the ultra-wide back to 1x would crop a
  /// sensor that is already the wrong one for reading a barcode.
  ///
  /// Android: `any`, CameraX's default back camera. `normal` adds the
  /// plugin's focal-length filter, and when no back camera classifies as
  /// normal (no lens data, a main lens outside 20–35 mm equivalent) the
  /// filter hands back CameraX's own read-only list; CameraX 1.6 (pulled in
  /// by `camera_android_camerax`) then calls `retainAll` on it and the bind
  /// throws, which the plugin reports as "no camera".
  @visibleForTesting
  static CameraLensType lensFor(TargetPlatform platform) =>
      platform == TargetPlatform.iOS
          ? CameraLensType.normal
          : CameraLensType.any;

  static MobileScannerController _build() => MobileScannerController(
    formats: _formats,
    detectionSpeed: DetectionSpeed.noDuplicates,
    lensType: lensFor(defaultTargetPlatform),
    // The frame each code was decoded from comes back with the capture, so
    // the scan screen can hold it frozen — what was scanned stays in view
    // while it is looked up and under the result. Only detection frames
    // carry an image, and `noDuplicates` keeps those to one per code.
    returnImage: true,
  );

  /// Re-arm the decode guard — scanning has (re)started.
  void arm() => _handledDetection = false;

  /// Completes once the plugin has stopped the camera. On Android the
  /// scanner and the label camera share one process-wide CameraX provider,
  /// and the scanner's stop unbinds everything bound to it, so the label
  /// camera must not open before this completes.
  ///
  /// A second release while the first is still stopping waits for it too.
  Future<void> release() async {
    final live = _controller;
    _controller = null;
    if (live != null) _teardown = reportingFailure(_stop(live));
    await _teardown;
  }

  Future<void>? _teardown;

  /// A scanner still starting has not bound its camera yet: disposed now, the
  /// plugin stops nothing, and the start that lands later unbinds whatever
  /// opened in the meantime and keeps the sensor. So the start lands first.
  static Future<void> _stop(MobileScannerController live) async {
    if (live.value.isStarting) await _started(live);
    await live.dispose();
  }

  /// Completes once [live] is no longer starting. Capped, because a start
  /// that throws something other than a scanner error never clears the flag.
  static Future<void> _started(MobileScannerController live) {
    final done = Completer<void>();
    void check() {
      if (!live.value.isStarting && !done.isCompleted) done.complete();
    }

    live.addListener(check);
    return done.future
        .timeout(const Duration(seconds: 5), onTimeout: () {})
        .whenComplete(() => live.removeListener(check));
  }

  /// The camera stopped on an error (a refused permission) — the user may
  /// have fixed it in Settings since.
  bool get hasFailed => _controller?.value.error != null;

  /// The light, for a code in a dim kitchen. The plugin only toggles, so this
  /// toggles only toward [on]; a camera that is not live yet (or has no
  /// torch) is left alone rather than thrown at.
  Future<void> setTorch(bool on) async {
    final live = _controller;
    if (live == null || !live.value.isInitialized) return;
    if ((live.value.torchState == TorchState.on) == on) return;
    await live.toggleTorch();
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
