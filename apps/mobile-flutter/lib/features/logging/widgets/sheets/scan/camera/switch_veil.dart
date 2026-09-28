import 'package:flutter/widgets.dart';

import '../../../../../../theme/kallo_motion.dart';

/// How long the live picture takes to dim out, and to come back.
const Duration kScanCameraFade = KalloMotion.quick;

/// The dip a mode switch makes: the live picture dims out BEFORE its camera is
/// handed back, and the next one fades up once it has a frame.
///
/// Why a dip at all: barcode and label run on two plugins (mobile_scanner, and
/// camera for the still), and one sensor can serve only one of them, so there
/// is a moment with no picture while one lets go and the other opens. Cut
/// straight, that moment was a hard black flash and then a pop. [onCovered]
/// is when the old camera may go — it is out of sight by then.
class ScanCameraVeil extends StatelessWidget {
  const ScanCameraVeil({
    super.key,
    required this.shown,
    required this.onCovered,
  });

  final bool shown;
  final VoidCallback onCovered;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedOpacity(
      opacity: shown ? 1 : 0,
      duration: kScanCameraFade,
      curve: KalloEase.standard,
      onEnd: () {
        if (shown) onCovered();
      },
      child: const ColoredBox(color: Color(0xFF000000)),
    ),
  );
}
