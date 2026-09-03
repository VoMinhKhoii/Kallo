import 'dart:ui' show AppLifecycleState;

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MissingPluginException;

import '../../../logic/label/image.dart';

/// Owns the label branch's [CameraController] outright: built on [open], torn
/// down when the app leaves the foreground (iOS revokes the capture session
/// anyway), rebuilt on resume, and disposed with the sheet. Nothing outside
/// holds a reference — the preview watches [controller] and rebuilds off it.
///
/// Separated from the widget for the same reason `BarcodeCameraSession` is:
/// the lifetime rules (single-flight opens, the backgrounded-mid-initialize
/// race, one shot at a time) are camera logic, not layout.
class LabelCameraSession {
  LabelCameraSession({required this.onCaptured, required this.onFailure});

  /// The path of the still the shutter just wrote.
  final ValueChanged<String> onCaptured;

  /// A camera that would not open or would not shoot, mapped onto the same
  /// failures the picker path reports so one error card serves both.
  final ValueChanged<LabelImageFailure> onFailure;

  /// The live controller, or null while none is open. Listen to rebuild.
  final ValueNotifier<CameraController?> controller =
      ValueNotifier<CameraController?>(null);

  CameraDescription? _camera;
  AppLifecycleState? _lifecycle;
  bool _opening = false;
  bool _shooting = false;
  bool _disposed = false;

  bool get _isBackgrounded =>
      _lifecycle == AppLifecycleState.inactive ||
      _lifecycle == AppLifecycleState.paused;

  Future<void> open() async {
    // A second open while the first `initialize()` is still pending would build
    // a rival CameraController on the same sensor (the resumed lifecycle path
    // can re-enter here); one at a time.
    if (_opening || _disposed) return;
    _opening = true;
    try {
      final camera = _camera ??= await _backCamera();
      if (camera == null) {
        if (_disposed) return;
        onFailure(LabelImageFailure.cameraUnavailable);
        return;
      }
      // veryHigh is ~1080p: enough to read small print on a nutrition panel
      // without the memory spike a full-resolution still costs on the stage.
      final opened = CameraController(
        camera,
        ResolutionPreset.veryHigh,
        enableAudio: false,
      );
      await opened.initialize();
      // The app may have gone to the background while `initialize()` was in
      // flight. Adopting the controller now would leave a live camera in a
      // paused app, and `resumed` would then see a non-null controller and
      // never reopen it — so drop it and let the next resume start afresh.
      if (_disposed || _isBackgrounded) {
        await opened.dispose();
        return;
      }
      controller.value = opened;
    } on CameraException catch (error) {
      if (_disposed) return;
      onFailure(labelFailureForCamera(error.code));
    } on MissingPluginException {
      // No camera plugin behind the channel (widget tests, unsupported host).
      // The stage stays dark and the library button is still the way in — this
      // is not something to report to the user as a failure.
    } finally {
      _opening = false;
    }
  }

  void handleLifecycle(AppLifecycleState state) {
    _lifecycle = state;
    final live = controller.value;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      if (live == null) return;
      controller.value = null;
      live.dispose();
    } else if (state == AppLifecycleState.resumed && live == null) {
      open();
    }
  }

  Future<void> shoot() async {
    final live = controller.value;
    if (live == null || _shooting) return;
    _shooting = true;
    try {
      final file = await live.takePicture();
      if (_disposed) return;
      onCaptured(file.path);
    } on CameraException catch (error) {
      if (_disposed) return;
      onFailure(labelFailureForCamera(error.code));
    } finally {
      _shooting = false;
    }
  }

  void dispose() {
    _disposed = true;
    controller.value?.dispose();
    controller.dispose();
  }

  Future<CameraDescription?> _backCamera() async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) return null;
    return cameras.firstWhere(
      (camera) => camera.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );
  }
}
