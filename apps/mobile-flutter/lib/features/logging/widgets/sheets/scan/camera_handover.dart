import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/label_scan_providers.dart';
import '../../../logic/scan/camera/barcode_session.dart';
import '../../../logic/scan/camera/label_session.dart';
import '../../../logic/scan/camera/teardown.dart';
import 'camera/mode_chip.dart';
import 'screen.dart';

/// Which camera holds the sensor: the barcode scanner or the label camera,
/// never both, handed over behind the switch's dip and restarted when the
/// user comes back from Settings with the permission they had refused.
///
/// Every start and stop of either camera goes through [_queue] — nothing
/// else in the screen opens or releases one. On Android both plugins share
/// one process-wide CameraX provider and each one's teardown unbinds
/// everything bound to it, so a camera started beside another's teardown
/// came up black.
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

  /// Every camera change runs here, one after the other. Each one reads
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
    // The camera queue is per screen; a screen closed a moment ago may still
    // be letting go of the sensor this one is about to take.
    await ScanCameraReleases.settled;
    if (!mounted) return;
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

  /// Back to the live camera of the mode on screen — from a result or a miss,
  /// or a switch taken back before its dip landed. With a switch still
  /// pending (`mode != cameraMode`), that switch opens the right camera.
  Future<void> resumeCamera() => _queue(() async {
    await ScanCameraReleases.settled;
    if (!mounted || mode != cameraMode) return;
    if (mode == ScanType.label) {
      // A no-op while the preview is up; re-reports a camera that would not
      // open, whose message the caller's retake just cleared.
      labelCamera.open();
      return;
    }
    barcodeCamera.arm();
    if (barcodeCamera.isRunning) return;
    // A new controller mounts a new scanner (`BarcodeCameraLayer` keys it).
    setState(barcodeCamera.ensure);
  });

  /// Rest the scanner while a caught code is looked up and under its result;
  /// [resumeCamera] builds it again.
  void restScanner() => _queue(barcodeCamera.release);

  /// The app has left the foreground since the last resume.
  bool _left = false;

  /// The label camera follows the app in and out of the foreground itself;
  /// the scanner is restarted only when the app comes back from really
  /// leaving, the trip a grant in Settings takes.
  void onAppLifecycle(AppLifecycleState state) {
    labelCamera.handleLifecycle(state);
    if (state == AppLifecycleState.paused) _left = true;
    if (state == AppLifecycleState.resumed && _left) {
      _left = false;
      restartFailedScanner();
    }
  }

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
