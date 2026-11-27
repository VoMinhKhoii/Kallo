import 'package:flutter/widgets.dart';
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
    onOpened: () {
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

  /// The veil is down: hand the sensor to the mode chosen by now (a second
  /// tap during the dip may have taken it back), and lift the veil.
  ///
  /// The outgoing camera is released BEFORE the incoming one starts: on
  /// Android both plugins share one process-wide CameraX provider, and each
  /// one's teardown unbinds everything bound to it — started together, the
  /// late teardown left the new camera black.
  Future<void> swapCamera() async {
    if (!mounted) return;
    if (mode != cameraMode) {
      await (mode == ScanType.label
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
  }

  /// Back from Settings with the scanner stopped on a refused permission:
  /// start a fresh one, which asks the plugin again. The screen calls this
  /// only after the app really left (`paused`) — a permission dialog only
  /// makes it `inactive`, and restarting as it closes would ask twice on
  /// Android.
  Future<void> restartFailedScanner() async {
    if (cameraMode != ScanType.barcode || !barcodeCamera.hasFailed) return;
    await barcodeCamera.release();
    if (!mounted) return;
    // One frame without a scanner, so the next one mounts on the new
    // controller instead of updating the old widget in place.
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || cameraMode != ScanType.barcode) return;
      barcodeCamera.ensure();
      barcodeCamera.arm();
      setState(() {});
    });
  }

  void toggleTorch() {
    setState(() => torch = !torch);
    if (cameraMode == ScanType.barcode) {
      barcodeCamera.setTorch(torch);
    } else {
      labelCamera.setTorch(torch);
    }
  }
}
