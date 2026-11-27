import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/label_scan_providers.dart';
import '../../../logic/scan/camera/barcode_session.dart';
import '../../../logic/scan/camera/label_session.dart';
import 'camera/mode_chip.dart';
import 'screen.dart';

/// Which camera holds the sensor: the barcode scanner or the label camera,
/// never both, handed over behind the switch's dip and restarted when the
/// user comes back from Settings with the permission they had refused.
mixin ScanCameraHandover on ConsumerState<ScanScreen> {
  ScanType mode = ScanType.barcode;
  bool torch = false;
  final barcodeCamera = BarcodeCameraSession();
  late final labelCamera = LabelCameraSession(
    onFailure: (failure) {
      if (mode == ScanType.label) labelNotifier.reportCaptureFailure(failure);
    },
    onRecovered: () {
      if (ref.read(labelScanProvider).cameraProblemKey != null) {
        labelNotifier.retake();
      }
    },
  );

  LabelScanController get labelNotifier => ref.read(labelScanProvider.notifier);

  /// The camera actually running, and on screen. Trails [mode] by the dip a
  /// switch makes (`ScanCameraVeil`): the chip moves at once, the camera
  /// swaps once the old picture has dimmed out.
  ScanType cameraMode = ScanType.barcode;

  /// The dip is covering the camera, or on its way to.
  bool veiled = false;

  /// Every change of camera runs here, one after the other. Each one reads
  /// [mode] and [cameraMode] when its turn comes, so taps that land during a
  /// teardown are settled by the next change instead of racing it.
  Future<void> _handover = Future.value();

  Future<void> _queue(Future<void> Function() change) =>
      _handover = _handover
          .then((_) => mounted ? change() : null)
          // A failed change is reported, not left in the chain: an error
          // there would skip every camera change after it.
          .catchError(
            (Object error, StackTrace stack) => FlutterError.reportError(
              FlutterErrorDetails(exception: error, stack: stack),
            ),
          );

  /// The veil is down: hand the sensor to the mode chosen by now (a second
  /// tap during the dip may have taken it back), and lift the veil.
  ///
  /// The camera on screen is released BEFORE the next one starts: on Android
  /// both plugins share one process-wide CameraX provider, and each one's
  /// teardown unbinds everything bound to it — started together, the late
  /// teardown left the new camera black.
  Future<void> swapCamera() => _queue(() async {
    if (mode != cameraMode) {
      await (cameraMode == ScanType.barcode
          ? barcodeCamera.release()
          : labelCamera.close());
      if (!mounted) return;
      // Read again: a tap during the teardown may have taken the mode back.
      if (mode == ScanType.label) {
        labelCamera.open();
      } else {
        barcodeCamera.ensure();
        barcodeCamera.arm();
      }
    }
    setState(() {
      cameraMode = mode;
      veiled = false;
    });
  });

  /// Back from Settings with the scanner stopped on a refused permission:
  /// start a fresh one, which asks the plugin again. The screen calls this
  /// only after the app really left (`paused`) — a permission dialog only
  /// makes it `inactive`, and restarting as it closes would ask twice on
  /// Android.
  Future<void> restartFailedScanner() => _queue(() async {
    bool scanning() =>
        mode == ScanType.barcode && cameraMode == ScanType.barcode;
    if (!scanning() || !barcodeCamera.hasFailed) return;
    await barcodeCamera.release();
    if (!mounted || !scanning()) return;
    // A new controller mounts a new scanner (`BarcodeCameraLayer` keys it).
    setState(() {
      barcodeCamera.ensure();
      barcodeCamera.arm();
    });
  });

  void toggleTorch() {
    setState(() => torch = !torch);
    if (cameraMode == ScanType.barcode) {
      barcodeCamera.setTorch(torch);
    } else {
      labelCamera.setTorch(torch);
    }
  }
}
