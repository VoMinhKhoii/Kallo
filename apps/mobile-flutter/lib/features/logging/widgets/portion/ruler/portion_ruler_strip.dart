import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/nham_theme.dart';
import 'portion_ruler_face.dart';
import 'portion_ruler_marks.dart';
import 'portion_ruler_painter.dart';

/// A tape-measure: the ruler and its silhouettes scroll together under a fixed
/// centre needle, instead of a needle travelling a static scale.
///
/// The silhouettes ride WITH the scale rather than sitting in a fixed row
/// above it. They have to: each glyph belongs to a graduation, so pinning them
/// while the scale moves would leave every silhouette pointing at the wrong
/// amount — the alignment is the whole premise of an integrated ruler.
///
/// Value is held by the caller in position space; this widget maps it to and
/// from a scroll offset. Flutter's own scroll physics supply the fling and the
/// rubber-band at the ends.
class PortionRulerStrip extends StatefulWidget {
  const PortionRulerStrip({
    super.key,
    required this.majors,
    required this.position,
    required this.graduations,
    required this.glyphBuilder,
    required this.labelFor,
    required this.glyphBandAspect,
    required this.onChanged,
  });

  /// Anchor positions as 0–1 fractions.
  final List<double> majors;

  /// Current value as a 0–1 fraction of the scale.
  final double position;

  final int graduations;

  /// Builds the silhouette for anchor [index], sized to [columnWidth].
  final Widget Function(int index, double columnWidth) glyphBuilder;

  /// Gram label under anchor [index].
  final String Function(int index) labelFor;

  /// width / height of the silhouette band, in column widths.
  final double glyphBandAspect;

  final ValueChanged<double> onChanged;

  @override
  State<PortionRulerStrip> createState() => _PortionRulerStripState();
}

class _PortionRulerStripState extends State<PortionRulerStrip> {
  /// Distance between two minor graduations.
  ///
  /// Deliberately tight. A tape measure only shows the part of the scale near
  /// the mark, but comparing the silhouettes to each other is what this sheet
  /// is FOR — at a loose pitch only two cuts are on screen and the comparison
  /// is gone. At 11 the strip runs ~1.3 viewports, so four of the five tiers
  /// stay visible while there is still a scale to travel.
  static const double _pitch = 11;

  /// Column width a silhouette is sized against — one anchor spacing.
  double get _column => _pitch * widget.graduations / widget.majors.length;

  double get _contentWidth => _pitch * widget.graduations;

  ScrollController? _controller;
  int? _lastGraduation;
  bool _selfDriven = false;

  @override
  void initState() {
    super.initState();
    // Not built from `build`: the offset depends only on `_pitch`, the
    // graduation count and the anchors, none of which come from layout, so
    // creating it here keeps build free of side effects.
    _controller = ScrollController(
      initialScrollOffset: widget.position * _contentWidth,
    )..addListener(_onScroll);
  }

  void _onScroll() {
    final c = _controller;
    if (c == null || !c.hasClients || _selfDriven) return;
    final fraction = (c.offset / _contentWidth).clamp(0.0, 1.0);
    final graduation = (fraction * widget.graduations).round();
    if (graduation != _lastGraduation) {
      _lastGraduation = graduation;
      // Haptic AND the platform click: the system selection sound is what makes
      // a picker read as a physical detent rather than a silent slide, and it
      // is the only cue a user with haptics disabled gets.
      HapticFeedback.selectionClick();
      SystemSound.play(SystemSoundType.click);
    }
    widget.onChanged(fraction);
  }

  @override
  void didUpdateWidget(PortionRulerStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    final c = _controller;
    if (c == null || !c.hasClients) return;
    final target = widget.position * _contentWidth;
    // Only chase an OUTSIDE change (an anchor tap). Re-driving the controller
    // from our own scroll would fight the drag.
    if ((c.offset - target).abs() > 0.5 && !c.position.isScrollingNotifier.value) {
      _selfDriven = true;
      c
          .animateTo(
            target,
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
          )
          .whenComplete(() => _selfDriven = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final viewport = constraints.maxWidth;
        final glyphHeight = _column / widget.glyphBandAspect;

        return Stack(
          alignment: Alignment.topCenter,
          children: [
            SingleChildScrollView(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              // Half a viewport of lead-in each side so the first and last
              // graduations can both reach the centre needle.
              padding: EdgeInsets.symmetric(horizontal: viewport / 2),
              child: SizedBox(
                width: _contentWidth,
                child: Column(
                  children: [
                    SizedBox(
                      height: glyphHeight,
                      child: PortionRulerBand(
                        majors: widget.majors,
                        width: _contentWidth,
                        slotWidth: _column,
                        child: (i) => widget.glyphBuilder(i, _column),
                      ),
                    ),
                    // Clearance for the needle cap — see portionNeedleGap.
                    const SizedBox(height: portionNeedleGap),
                    CustomPaint(
                      size: Size(_contentWidth, portionRulerHeight),
                      painter: PortionRulerPainter(
                        majors: widget.majors,
                        graduations: widget.graduations,
                      ),
                    ),
                    const SizedBox(height: NhamSpacing.sp1),
                    // Scaled, not fixed. Every child of PortionRulerBand is
                    // `Positioned`, so the Stack cannot size itself to them and
                    // the band needs a height — but a flat 18 clipped the gram
                    // digits at the 1.3x Dynamic Type ceiling, and a clipped
                    // gram figure reads as a plausible but wrong number.
                    SizedBox(
                      height: MediaQuery.textScalerOf(context).scale(18),
                      child: PortionRulerBand(
                        majors: widget.majors,
                        width: _contentWidth,
                        slotWidth: _column,
                        child: (i) => Text(
                          widget.labelFor(i),
                          maxLines: 1,
                          style: dashMeta(tabular: true),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            IgnorePointer(child: PortionRulerNeedle(height: glyphHeight)),
          ],
        );
      },
    );
  }
}
