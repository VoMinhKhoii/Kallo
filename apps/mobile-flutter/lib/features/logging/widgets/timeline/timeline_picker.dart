import 'package:flutter/material.dart';

import '../../../../shell/header/app_header.dart';
import '../../../../theme/kallo_motion.dart';
import 'timeline_chip.dart';
import 'timeline_strip.dart';

/// Morphs the date chip IN PLACE into the week strip (and back), at a fixed
/// height so the feed below never shifts. One controller drives a cross-dissolve
/// — the chip fades and shrinks out as the strip fades and scales in. Tapping
/// the chip expands; the parent collapses on any outside tap (the scrim) or a
/// day selection.
///
/// Both layers stay mounted for the whole morph, keyed, and are built ONCE per
/// rebuild of this widget rather than inside the animation's builder. That is
/// not a micro-optimisation — it is the fix for two real defects:
///
/// * The layers used to be added and removed by `if (t < 1)` / `if (t > 0)`
///   inside a `Stack`, so the children list changed length at t == 1 and again
///   on the first frame of a collapse. Both branches were unkeyed `Opacity`, so
///   Flutter matched the surviving strip against the chip's slot, found `Row`
///   against `Transform` three levels down, and destroyed the entire
///   `TimelineStrip` — PageView, PageController and the week the user had paged
///   to — in the middle of an animation frame. Keys make that a retire instead.
///
/// * Building inside the builder re-ran, ~20 times per morph, two `DateFormat`
///   constructions for the chip's label, `dates.toSet()` over every date the
///   user has ever logged, and seven day cells with a `DateFormat` each.
///
/// What is left in the builder is [FadeTransition] and [ScaleTransition], which
/// animate at the render-object level and rebuild nothing at all.
class DateMorph extends StatefulWidget {
  const DateMorph({
    super.key,
    required this.dates,
    required this.today,
    required this.selectedDate,
    required this.expanded,
    required this.onSelectDate,
    required this.onExpand,
    required this.onCollapse,
  });

  final List<String> dates;
  final String today;
  final String selectedDate;
  final bool expanded;
  final ValueChanged<String> onSelectDate;
  final VoidCallback onExpand;
  final VoidCallback onCollapse;

  @override
  State<DateMorph> createState() => _DateMorphState();
}

class _DateMorphState extends State<DateMorph>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: KalloMotion.morph,
    value: widget.expanded ? 1 : 0,
  );

  late final Animation<double> _eased = CurvedAnimation(
    parent: _c,
    curve: KalloEase.enter,
  );

  /// The chip leaves early and the strip arrives late, so the two never sit at
  /// full strength together — the handoff reads as one object changing rather
  /// than two objects overlapping.
  late final Animation<double> _chipFade = Tween<double>(
    begin: 1,
    end: 0,
  ).animate(CurvedAnimation(parent: _eased, curve: const Interval(0, 0.625)));

  late final Animation<double> _chipScale = Tween<double>(
    begin: 1,
    end: 0.96,
  ).animate(_eased);

  late final Animation<double> _stripFade = CurvedAnimation(
    parent: _eased,
    curve: const Interval(0.25, 1),
  );

  late final Animation<double> _stripScale = Tween<double>(
    begin: 0.96,
    end: 1,
  ).animate(_eased);

  @override
  void didUpdateWidget(DateMorph old) {
    super.didUpdateWidget(old);
    if (widget.expanded != old.expanded) {
      if (widget.expanded) {
        _c.forward();
      } else {
        _c.reverse();
      }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Fixed height = the expanded strip's height, so morphing never pushes the
    // feed; the collapsed chip just centers in it.
    return SizedBox(
      height: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Collapsed layer: hamburger + centered chip + mirror spacer. The
          // hamburger lives here, so it fades out as the strip expands.
          KeyedSubtree(
            key: const ValueKey('morph-chip'),
            child: IgnorePointer(
              ignoring: widget.expanded,
              child: FadeTransition(
                opacity: _chipFade,
                child: ScaleTransition(
                  scale: _chipScale,
                  child: Row(
                    children: [
                      const AppMenuButton(),
                      Expanded(
                        child: Center(
                          child: TimelineChip(
                            dates: widget.dates,
                            selectedDate: widget.selectedDate,
                            onTap: widget.onExpand,
                          ),
                        ),
                      ),
                      const SizedBox(width: 44, height: 44),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Expanded layer: the week strip, FULL header width.
          KeyedSubtree(
            key: const ValueKey('morph-strip'),
            child: IgnorePointer(
              ignoring: !widget.expanded,
              child: FadeTransition(
                opacity: _stripFade,
                child: ScaleTransition(
                  scale: _stripScale,
                  child: TimelineStrip(
                    dates: widget.dates,
                    today: widget.today,
                    selectedDate: widget.selectedDate,
                    expanded: widget.expanded,
                    onSelectDate: widget.onSelectDate,
                    onClose: widget.onCollapse,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
