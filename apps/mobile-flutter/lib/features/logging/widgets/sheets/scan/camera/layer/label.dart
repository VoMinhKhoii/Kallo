import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../preview_fade_in.dart';
import '../problem.dart';
import '../mode_chip.dart';
import '../window.dart';

/// The label camera, full screen: the live preview cover-cropped to the screen
/// — or the photo just taken, held while it is read and while the result is
/// up, so the table stays in view.
class LabelCameraLayer extends StatelessWidget {
  const LabelCameraLayer({
    super.key,
    required this.controller,
    required this.photoPath,
    this.problem,
  });

  final ValueListenable<CameraController?> controller;

  /// The captured or picked photo, once there is one.
  final String? photoPath;

  /// Why there is no picture to read: a camera that would not open, or a
  /// library photo that could not be used.
  final String? problem;

  /// The plugin paints at the sensor's aspect; give it that box and let
  /// FittedBox cover the screen, clipping the overflow.
  static Widget _preview(CameraController live, Size size) {
    final portrait = 1 / live.value.aspectRatio;
    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: size.width,
          height: size.width / portrait,
          child: CameraPreview(live),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final window = scanWindowFor(ScanType.label, size);
        return Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Color(0xFF000000)),
            if (photoPath != null)
              Image.file(File(photoPath!), fit: BoxFit.cover)
            else
              ScanPreviewFadeIn(
                source: controller,
                isReady: () => controller.value?.value.isInitialized ?? false,
                child: ValueListenableBuilder<CameraController?>(
                  valueListenable: controller,
                  builder:
                      (context, live, _) =>
                          live != null && live.value.isInitialized
                              ? _preview(live, size)
                              : const SizedBox.shrink(),
                ),
              ),
            if (photoPath == null && problem != null)
              ScanCameraProblem(text: problem!),
            if (photoPath == null)
              IgnorePointer(
                child: CustomPaint(painter: ScanOutlinePainter(window: window)),
              ),
          ],
        );
      },
    );
  }
}
