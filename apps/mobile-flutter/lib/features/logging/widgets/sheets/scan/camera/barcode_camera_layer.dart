import 'dart:typed_data';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'scan_camera_problem.dart';
import 'scan_mode_chip.dart';
import 'scan_window.dart';

/// The barcode camera, full screen: the live preview decoding inside the scan
/// window — or, once a code is caught, the FROZEN frame it was caught in, so
/// the user keeps seeing what they scanned while it is looked up and while the
/// result sheet is up.
class BarcodeCameraLayer extends StatelessWidget {
  const BarcodeCameraLayer({
    super.key,
    required this.controller,
    required this.frozen,
    required this.onDetect,
  });

  /// Null while the camera is released (a result is showing).
  final MobileScannerController? controller;

  /// The frame the code was decoded from, when mobile_scanner returned one.
  final Uint8List? frozen;

  final ValueChanged<BarcodeCapture> onDetect;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final window = scanWindowFor(ScanType.barcode, size);
        final live = controller;
        return Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Color(0xFF000000)),
            if (live != null && frozen == null)
              MobileScanner(
                controller: live,
                fit: BoxFit.cover,
                scanWindow: window,
                onDetect: onDetect,
                errorBuilder:
                    (context, error) => ScanCameraProblem(
                      text:
                          (error.errorCode ==
                                      MobileScannerErrorCode.permissionDenied
                                  ? 'logging.barcode.cameraDenied'
                                  : 'logging.barcode.cameraError')
                              .tr(),
                    ),
              ),
            if (frozen != null)
              Image.memory(frozen!, fit: BoxFit.cover, gaplessPlayback: true),
            IgnorePointer(
              child: CustomPaint(
                painter: ScanOutlinePainter(
                  window: window,
                  solid: frozen != null || live == null,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
