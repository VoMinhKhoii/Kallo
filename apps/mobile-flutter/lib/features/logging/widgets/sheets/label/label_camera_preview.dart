import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../logic/label/image.dart';
import '../scan/scan_camera_stage.dart';
import 'label_camera_session.dart';

/// The label branch's live viewport: the back camera running inside the shared
/// dark [ScanCameraStage], with the shutter and the photo-library button in
/// the stage's own control slots.
///
/// Before this the stage was EMPTY — a dark rectangle with a fake shutter that
/// opened `image_picker`'s full-screen OS camera. The barcode branch has shown
/// a live picture from the first frame all along; this makes the two branches
/// behave the same way, and the framing hint finally has a frame to describe.
///
/// The camera itself lives in [LabelCameraSession]; this widget only wires it
/// to the app lifecycle and paints whatever controller it currently holds.
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
  late final LabelCameraSession _session = LabelCameraSession(
    onCaptured: (path) {
      if (mounted) widget.onCaptured(path);
    },
    onFailure: (failure) {
      if (mounted) widget.onFailure(failure);
    },
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session.open();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      _session.handleLifecycle(state);

  @override
  Widget build(BuildContext context) {
    return ScanCameraStage(
      hint: widget.hint,
      shutterLabel: widget.shutterLabel,
      onShutter: _session.shoot,
      leading: widget.leading,
      builder: (context, size) => ValueListenableBuilder<CameraController?>(
        valueListenable: _session.controller,
        builder: (context, controller, _) =>
            controller == null || !controller.value.isInitialized
            ? const SizedBox.shrink()
            : _preview(controller, size),
      ),
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
