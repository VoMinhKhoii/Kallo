import 'package:flutter/cupertino.dart';

import '../../../../../../theme/calm_tokens.dart';
import 'mode_chip.dart';
import 'window.dart';

/// "Looking up" / "Reading the label": the frozen frame darkened (the owner
/// likes that the dim says "working"), with one line under the scan window.
/// The window keeps its place, so the thing being read stays where the user
/// aimed it.
class ScanLoadingOverlay extends StatelessWidget {
  const ScanLoadingOverlay({super.key, required this.mode, required this.text});

  final ScanType mode;
  final String text;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final window = scanWindowFor(mode, constraints.biggest);
        return Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Color(0x4D000000)),
            Positioned(
              top: window.bottom + 24,
              left: 0,
              right: 0,
              child: Semantics(
                liveRegion: true,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CupertinoActivityIndicator(
                      color: Color(0xFFFFFFFF),
                      radius: 9,
                    ),
                    const SizedBox(width: 10),
                    Text(text, style: dashBody(color: const Color(0xFFFFFFFF))),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
