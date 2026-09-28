import 'dart:ui' show AppLifecycleState;

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MissingPluginException;

import '../../../../../logic/label/image.dart';

/// Owns the label branch's [CameraController] outright: built on [open], torn
/// down when the app leaves the foreground (iOS revokes the capture session
/// anyway), rebuilt on resume, and disposed with the sheet. Nothing outside
/// holds a reference — the preview watches [controller] and rebuilds off it.
///
/// Separated from the widget for the same reason `BarcodeCameraSession` is:
/// the lifetime rules (single-flight opens, the backgrounded-mid-initialize
/// race, one shot at a time) are camera logic, not layout.
class LabelCameraSession {
  LabelCameraSession({required this.onFailure});

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

  /// Whether the screen wants this camera: set by [open], cleared by [close].
  /// A resume reopens only a wanted camera — in barcode mode it must stay shut,
  /// or it would hold the sensor beside the barcode scanner.
  bool _wanted = false;

  /// The in-flight teardown of the last live controller. `CameraController
  /// .dispose()` releases the device asynchronously, and opening a new
  /// controller on the same iOS camera before that completes races the
  /// hardware ("camera in use", a black preview) — so every open waits for it.
  Future<void>? _teardown;

  /// A shot is being taken; the shutter waits for it.
  bool get isShooting => _shooting;

  bool get _isBackgrounded =>
      _lifecycle == AppLifecycleState.inactive ||
      _lifecycle == AppLifecycleState.paused;

  Future<void> open() async {
    _wanted = true;
    // A second open while the first `initialize()` is still pending would build
    // a rival CameraController on the same sensor (the resumed lifecycle path
    // can re-enter here); one at a time.
    if (_opening || _disposed) return;
    _opening = true;
    await _teardown;
    _teardown = null;
    if (_disposed || _isBackgrounded || !_wanted || controller.value != null) {
      _opening = false;
      return;
    }
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
      // Likewise a [close] that landed mid-initialize.
      if (_disposed || _isBackgrounded || !_wanted) {
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
      _teardown = live.dispose();
    } else if (state == AppLifecycleState.resumed && live == null && _wanted) {
      // `open()` awaits [_teardown] and re-checks the lifecycle after it, so
      // a resume that lands mid-teardown reopens only once the device is free.
      open();
    }
  }

  /// Hand the sensor back (the screen switched to the barcode scanner): the
  /// controller is torn down, and a resume leaves it shut until [open].
  void close() {
    _wanted = false;
    final live = controller.value;
    if (live == null) return;
    controller.value = null;
    _teardown = live.dispose();
  }

  /// Take a still; resolves to its path, or null when there is no camera, a
  /// shot is already in flight, or the camera failed ([onFailure] was told).
  Future<String?> shoot() async {
    final live = controller.value;
    if (live == null || _shooting) return null;
    _shooting = true;
    try {
      final file = await live.takePicture();
      return _disposed ? null : file.path;
    } on CameraException catch (error) {
      if (!_disposed) onFailure(labelFailureForCamera(error.code));
      return null;
    } finally {
      _shooting = false;
    }
  }

  /// The light, for a table printed in a dim kitchen. Ignored while no camera
  /// is open; a device without a torch simply stays dark.
  Future<void> setTorch(bool on) async {
    final live = controller.value;
    if (live == null) return;
    try {
      await live.setFlashMode(on ? FlashMode.torch : FlashMode.off);
    } on CameraException {
      // No torch on this camera — nothing to turn on.
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
