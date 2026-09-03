import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MissingPluginException;

import '../../../logic/label/image.dart';
import '../scan/scan_camera_stage.dart';

/// The label branch's live viewport: the back camera running inside the shared
/// dark [ScanCameraStage], with the shutter and the photo-library button in
/// the stage's own control slots.
///
/// Before this the stage was EMPTY — a dark rectangle with a fake shutter that
/// opened `image_picker`'s full-screen OS camera. The barcode branch has shown
/// a live picture from the first frame all along; this makes the two branches
/// behave the same way, and the framing hint finally has a frame to describe.
///
/// Owns the [CameraController] outright: it is built here, torn down when the
/// app leaves the foreground (iOS revokes the capture session anyway), rebuilt
/// on resume, and disposed on unmount. Nothing outside holds a reference.
class LabelCameraPreview extends StatefulWidget {
  const LabelCameraPreview({
    super.key,
    required this.hint,
    required this.shutterLabel,
    required this.leading,
    required this.onCaptured,
    required this.onFailure,
  });

  final String hint;
  final String shutterLabel;

  /// The stage's bottom-left control — the photo-library button.
  final Widget leading;

  /// The path of the still the shutter just wrote.
  final ValueChanged<String> onCaptured;

  /// A camera that would not open or would not shoot, mapped onto the same
  /// failures the picker path reports so one error card serves both.
  final ValueChanged<LabelImageFailure> onFailure;

  @override
  State<LabelCameraPreview> createState() => _LabelCameraPreviewState();
}

class _LabelCameraPreviewState extends State<LabelCameraPreview>
    with WidgetsBindingObserver {
  CameraController? _controller;
  CameraDescription? _camera;
  bool _shooting = false;
  bool _opening = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _open();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      if (controller == null) return;
      setState(() => _controller = null);
      controller.dispose();
    } else if (state == AppLifecycleState.resumed && controller == null) {
      _open();
    }
  }

  Future<void> _open() async {
    // A second open while the first `initialize()` is still pending would build
    // a rival CameraController on the same sensor (the resumed lifecycle path
    // can re-enter here); one at a time.
    if (_opening) return;
    _opening = true;
    try {
      final camera = _camera ??= await _backCamera();
      if (camera == null) {
        if (!mounted) return;
        widget.onFailure(LabelImageFailure.cameraUnavailable);
        return;
      }
      // veryHigh is ~1080p: enough to read small print on a nutrition panel
      // without the memory spike a full-resolution still costs on the stage.
      final controller = CameraController(
        camera,
        ResolutionPreset.veryHigh,
        enableAudio: false,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() => _controller = controller);
    } on CameraException catch (error) {
      if (!mounted) return;
      widget.onFailure(_failureFor(error));
    } on MissingPluginException {
      // No camera plugin behind the channel (widget tests, unsupported host).
      // The stage stays dark and the library button is still the way in — this
      // is not something to report to the user as a failure.
    } finally {
      _opening = false;
    }
  }

  Future<CameraDescription?> _backCamera() async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) return null;
    return cameras.firstWhere(
      (camera) => camera.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );
  }

  /// Only a refused permission is worth sending someone to Settings for; the
  /// rest are retries.
  LabelImageFailure _failureFor(CameraException error) => switch (error.code) {
    'CameraAccessDenied' ||
    'CameraAccessDeniedWithoutPrompt' ||
    'CameraAccessRestricted' => LabelImageFailure.permissionDenied,
    _ => LabelImageFailure.cameraUnavailable,
  };

  Future<void> _shutter() async {
    final controller = _controller;
    if (controller == null || _shooting) return;
    setState(() => _shooting = true);
    try {
      final file = await controller.takePicture();
      if (!mounted) return;
      widget.onCaptured(file.path);
    } on CameraException catch (error) {
      if (!mounted) return;
      widget.onFailure(_failureFor(error));
    } finally {
      if (mounted) setState(() => _shooting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return ScanCameraStage(
      hint: widget.hint,
      shutterLabel: widget.shutterLabel,
      onShutter: _shutter,
      leading: widget.leading,
      builder: (context, size) =>
          controller == null || !controller.value.isInitialized
          ? const SizedBox.shrink()
          : _preview(controller, size),
    );
  }

  /// Cover-fit the sensor's frame to the 3:4 stage. [CameraPreview] carries its
  /// own [AspectRatio], so it is given a box at exactly that ratio and the
  /// [FittedBox] scales it up until it fills the stage; [ClipRect] takes the
  /// overflow. Letting it letterbox instead would leave dark bars inside a
  /// frame whose whole job is to show what the shutter will capture.
  Widget _preview(CameraController controller, Size size) {
    final portraitRatio = 1 / controller.value.aspectRatio;
    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: size.width,
          height: size.width / portraitRatio,
          child: CameraPreview(controller),
        ),
      ),
    );
  }
}
