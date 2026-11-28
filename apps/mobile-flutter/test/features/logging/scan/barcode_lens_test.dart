import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:kallo_mobile/features/logging/logic/scan/camera/barcode_session.dart';

/// Which lens the barcode scanner asks for on each phone platform.
void main() {
  test('iOS asks for the 1x lens by name', () {
    expect(
      BarcodeCameraSession.lensFor(TargetPlatform.iOS),
      CameraLensType.normal,
    );
  });

  // `normal` on Android runs the plugin's focal-length filter, whose
  // fallback breaks the bind under CameraX 1.6 ("camera isn't available").
  test('Android takes the default back camera', () {
    expect(
      BarcodeCameraSession.lensFor(TargetPlatform.android),
      CameraLensType.any,
    );
  });
}
