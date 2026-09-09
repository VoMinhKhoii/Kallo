import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/measured_height.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

/// The composer's floating dock: the feed FLOWS UNDER it. The list runs the
/// full height of the tab and its cards pass behind the dock as you scroll,
/// rather than the feed stopping short above a bar that owns its own slice of
/// the screen.
///
/// The dock's base is a solid surface, not a translucent one — cards disappear
/// behind it cleanly, and the composer card inside floats on its own shadow.
/// Its TOP edge, though, is a gradient scrim ([scrimHeight] tall, surface →
/// transparent going up): a card sliding under the dock fades out over that
/// band instead of being guillotined by a hard horizontal line. The composer
/// card itself never goes translucent — you read the feed through the DOCK,
/// never through the input.
///
/// The dock reports its own height through [onHeightChanged] so the feed can
/// reserve exactly that much scroll padding; nothing is ever permanently
/// hidden behind it.
class ComposerDock extends StatelessWidget {
  const ComposerDock({
    super.key,
    required this.child,
    required this.onHeightChanged,
  });

  final Widget child;

  /// Fired (post-frame) whenever the dock's laid-out height changes — the
  /// composer grows with multiline text and with cheat mode's extra controls.
  final ValueChanged<double> onHeightChanged;

  /// Height of the fade band above the opaque base. Deep enough that a meal
  /// card's last line dissolves rather than blinking out; short enough that the
  /// reserved scroll padding stays honest.
  static const double scrimHeight = KalloSpacing.sp8; // 32

  @override
  Widget build(BuildContext context) {
    // The dock rides the keyboard, and this is the ONE place that says so:
    // `/logging` is a root route with no `Scaffold`, so no
    // `resizeToAvoidBottomInset` lifts anything here — without this the dock
    // stays pinned to the physical screen bottom and the keyboard covers it.
    //
    // A plain `Padding`, never an `AnimatedPadding`: iOS ramps `viewInsets`
    // continuously over ~250ms, so this already follows the keyboard frame by
    // frame; animating it again would lag the keyboard and double-animate the
    // dismiss into the flicker this exists to remove.
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    // `padding.bottom` is the home indicator ALREADY netted against the
    // keyboard — `max(viewPadding.bottom - viewInsets.bottom, 0)` — so paying
    // it inside a box that is itself lifted by `keyboardInset` is one
    // continuous expression (the same shape as `LoggingSpacing.quickLogGap`):
    // never double-counted, and no step where the two cross.
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    // Rebuilding the dock is NOT the only way it changes height: the composer
    // grows a line under the user's thumb via its own setState, which never
    // re-runs this build. [MeasuredHeight] catches that on its own; without
    // it the reserved padding would go stale mid-type and the last meal card
    // would slide under the dock.
    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      // Measured INSIDE the lift, so the height reported up is the dock's own
      // and does NOT move with the keyboard. The feed adds the same inset to
      // its reserve itself, in the same frame.
      child: MeasuredHeight(
        onChanged: onHeightChanged,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The fade band. Full-bleed (no horizontal inset) so the wall the
            // feed used to hit disappears across the whole width. It replaces
            // the dock's old top padding, so the composer keeps its breathing
            // room and the measured height stays comparable.
            const SizedBox(
              height: ComposerDock.scrimHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    // KalloColors.surface at 0 / 35 / 85 / 100% alpha. Eased,
                    // not linear: a straight alpha ramp still reads as a
                    // visible seam where it meets transparency. All four stops
                    // come from the token — the first three used to restate
                    // the hex, so moving the canvas left the ramp fading
                    // toward the *old* colour, i.e. the seam it exists to
                    // remove.
                    colors: [
                      KalloColors.surface0,
                      KalloColors.surface35,
                      KalloColors.surface85,
                      KalloColors.surface,
                    ],
                    stops: [0, 0.45, 0.8, 1],
                  ),
                ),
              ),
            ),
            // The opaque base — everything from the composer card down is a
            // solid surface, including the home-indicator inset. Flexible so a
            // BOUNDED dock shrinks what it holds (the `/` picker yields first)
            // rather than overflowing the Stack it is aligned in.
            Flexible(
              child: Container(
                color: KalloColors.surface,
                padding: EdgeInsets.fromLTRB(
                  KalloSpacing.sp3,
                  0,
                  KalloSpacing.sp3,
                  bottomInset + LoggingSpacing.block,
                ),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
