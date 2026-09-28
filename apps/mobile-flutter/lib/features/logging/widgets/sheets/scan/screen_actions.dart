import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../privacy/logic/ai_consent_gate.dart';
import '../../../data/barcode_providers.dart';
import '../../../data/label_scan_providers.dart';
import 'camera/mode_chip.dart';
import 'camera/session/barcode.dart';
import 'camera/session/label.dart';
import 'result_actions.dart';
import 'screen.dart';

/// What the scan screen does with its CAMERA — switch mode, catch a code,
/// take or pick a photo and read it, go back to scanning — kept apart from its
/// lifecycle and layout. The result's own state is [ScanResultActions]'.
mixin ScanScreenActions on ConsumerState<ScanScreen>, ScanResultActions {
  ScanType mode = ScanType.barcode;
  final barcodeCamera = BarcodeCameraSession();
  late final labelCamera = LabelCameraSession(
    onFailure: (failure) {
      if (mode == ScanType.label) labelNotifier.reportCaptureFailure(failure);
    },
  );

  /// The frame a barcode was decoded from, held while it is looked up and
  /// under its result.
  Uint8List? frozen;
  bool torch = false;

  /// The photo in flight. Bumped by every new photo (shutter, library) and by
  /// every change of camera session (a mode switch, back to scanning); a photo
  /// tagged with an older token is dropped before it is held — it never
  /// shows, never replaces the newer photo, and never goes to the AI. The
  /// latest photo always wins.
  int _photoToken = 0;

  BarcodeFlowController get barcodeNotifier =>
      ref.read(barcodeFlowProvider.notifier);
  LabelScanController get labelNotifier => ref.read(labelScanProvider.notifier);

  /// Each mode starts clean: a miss or result left in the other mode (a
  /// "Not found" that led here via "Scan nutrition label") must not be
  /// waiting when the user switches back — and each mode holds the sensor
  /// alone, so the other's camera is handed back first.
  void switchMode(ScanType next) {
    _photoToken++;
    setState(() {
      mode = next;
      torch = false;
      frozen = null;
      clearResult();
    });
    barcodeNotifier.scanAgain();
    labelNotifier.retake();
    if (next == ScanType.label) {
      barcodeCamera.release();
      labelCamera.open();
    } else {
      labelCamera.close();
      barcodeCamera.ensure();
      barcodeCamera.arm();
    }
  }

  void toggleTorch() {
    setState(() => torch = !torch);
    if (mode == ScanType.barcode) {
      barcodeCamera.setTorch(torch);
    } else {
      labelCamera.setTorch(torch);
    }
  }

  void onDetect(BarcodeCapture capture) {
    if (typing ||
        ref.read(barcodeFlowProvider).phase != BarcodeFlowPhase.scanning) {
      return;
    }
    final raw = barcodeCamera.claimDetection(capture);
    if (raw == null) return;
    final frame = capture.image;
    setState(() {
      frozen = frame;
      // A released camera takes its light with it.
      if (frame != null) torch = false;
    });
    // With a frame to hold, the camera can rest while the code is looked up
    // and under its result; resuming builds it again.
    if (frame != null) barcodeCamera.release();
    barcodeNotifier.search(raw);
  }

  void lookUpTyped(String digits) {
    setState(() => typing = false);
    barcodeNotifier.search(digits, force: true);
  }

  /// A photo is in (shutter or library): read it straight away — no second
  /// "scan this photo" step. The photo goes to the AI provider, so consent
  /// comes first (App Store 5.1.2(i)). [hold] commits the photo, asking
  /// [isCurrent] first; [token] is the photo's own.
  Future<void> _takePhoto(
    int token,
    Future<void> Function(bool Function() isCurrent) hold,
  ) async {
    bool isCurrent() => mounted && token == _photoToken;
    await hold(isCurrent);
    if (!isCurrent()) return;
    if (ref.read(labelScanProvider).phase == LabelScanPhase.preview) {
      scanLabel();
    }
  }

  /// The shutter.
  Future<void> shoot() async {
    // A second tap while the first shot is still being taken is not a new
    // photo: it must not supersede the one on its way.
    if (labelCamera.isShooting) return;
    final token = ++_photoToken;
    final path = await labelCamera.shoot();
    if (path == null) return;
    await _takePhoto(
      token,
      (isCurrent) => labelNotifier.captureFromFile(path, isCurrent: isCurrent),
    );
  }

  /// Send the held photo — once consent is on record. "Not now" drops the
  /// photo and goes back to the camera rather than leaving it frozen there.
  Future<void> scanLabel() async {
    final ok = await ensureAiConsent(context, ref);
    if (!mounted) return;
    ok ? labelNotifier.scan() : labelNotifier.retake();
  }

  void pickFromLibrary() => _takePhoto(
    ++_photoToken,
    (isCurrent) =>
        labelNotifier.pickImage(ImageSource.gallery, isCurrent: isCurrent),
  );

  /// Back to a live camera from any result or miss.
  void resumeScanning() {
    _photoToken++;
    setState(() {
      frozen = null;
      clearResult();
    });
    if (mode == ScanType.barcode) {
      barcodeNotifier.scanAgain();
      barcodeCamera.ensure();
      barcodeCamera.arm();
    } else {
      labelNotifier.retake();
      // A no-op while the preview is up; re-reports a camera that would not
      // open, whose message the retake just cleared.
      labelCamera.open();
    }
  }
}
