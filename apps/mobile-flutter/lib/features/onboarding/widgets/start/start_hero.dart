import 'package:flutter/material.dart';

import '../../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../../shared/widgets/brand/wordmark_bar.dart';
import 'start_preview_box.dart';

/// The wordmark over the device and its dishes: the far pane of every
/// signed-out screen beside the fold. `/start` opens on it, and sign-in, the
/// wizard and `/save-plan` keep it standing while the other half changes.
///
/// A [Hero], so a push between those routes leaves it where it is instead of
/// sliding one copy over another.
class StartHero extends StatelessWidget {
  const StartHero({super.key});

  /// The wordmark row starts this far under the safe area, and the preview
  /// this far under the row: the same two measures `/start` uses in one
  /// column.
  static const double headerTop = 8;
  static const double headerGap = 16;
  static const double wordmarkHeight = 34;

  @override
  Widget build(BuildContext context) => const Hero(
    tag: 'start-hero',
    transitionOnUserGestures: true,
    // In flight the pane's own clip is gone, and the dishes bleed past the
    // pane on both sides by design.
    child: ClipRect(
      child: SafeArea(
        minimum: EdgeInsets.only(top: 12),
        child: Column(
          children: [
            SizedBox(height: headerTop),
            SizedBox(
              height: WordmarkBar.rowHeight,
              child: Center(child: KalloWordmark(height: wordmarkHeight)),
            ),
            SizedBox(height: headerGap),
            Expanded(child: StartPreviewBox()),
          ],
        ),
      ),
    ),
  );
}
