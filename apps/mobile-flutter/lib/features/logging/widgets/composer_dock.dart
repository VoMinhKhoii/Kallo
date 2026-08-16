import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';
import 'composer_glow.dart';

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
class ComposerDock extends StatefulWidget {
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
  static const double scrimHeight = NhamSpacing.sp8; // 32

  @override
  State<ComposerDock> createState() => _ComposerDockState();
}

class _ComposerDockState extends State<ComposerDock> {
  final GlobalKey _dockKey = GlobalKey();
  double _reportedHeight = 0;

  void _reportHeight() {
    if (!mounted) return;
    final box = _dockKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final height = box.size.height;
    // Sub-pixel churn would ping-pong the parent's setState forever.
    if ((height - _reportedHeight).abs() < 0.5) return;
    _reportedHeight = height;
    widget.onHeightChanged(height);
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _reportHeight());
    final bottomInset = MediaQuery.of(context).padding.bottom;

    // Rebuilding the dock is NOT the only way it changes height: the composer
    // grows a line under the user's thumb via its own setState, which never
    // re-runs this build. Without the notifier the reserved padding would go
    // stale mid-type and the last meal card would slide under the dock.
    return NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (_) {
        // Fired during layout — defer the parent's setState past this frame.
        WidgetsBinding.instance.addPostFrameCallback((_) => _reportHeight());
        return false;
      },
      child: SizeChangedLayoutNotifier(
        child: Column(
          key: _dockKey,
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
                    // NhamColors.surface at 0 / 35 / 85 / 100% alpha. Eased,
                    // not linear: a straight alpha ramp still reads as a
                    // visible seam where it meets transparency. All four stops
                    // come from the token — the first three used to restate
                    // the hex, so moving the canvas left the ramp fading
                    // toward the *old* colour, i.e. the seam it exists to
                    // remove.
                    colors: [
                      NhamColors.surface0,
                      NhamColors.surface35,
                      NhamColors.surface85,
                      NhamColors.surface,
                    ],
                    stops: [0, 0.45, 0.8, 1],
                  ),
                ),
              ),
            ),
            // The opaque base — everything from the composer card down is a
            // solid surface, including the home-indicator inset.
            Container(
              color: NhamColors.surface,
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp3,
                0,
                NhamSpacing.sp3,
                bottomInset + LoggingSpacing.block,
              ),
              // The halo sits under the composer card and over the base. Not
              // clipped: it bleeds up across the scrim band so the warmth
              // reaches into the feed rather than stopping at a horizontal
              // line where the dock begins.
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Positioned(
                    top: -ComposerGlow.bleedTop,
                    left: -ComposerGlow.bleedEdge,
                    right: -ComposerGlow.bleedEdge,
                    bottom: -ComposerGlow.bleedEdge,
                    child: ComposerGlow(),
                  ),
                  widget.child,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
