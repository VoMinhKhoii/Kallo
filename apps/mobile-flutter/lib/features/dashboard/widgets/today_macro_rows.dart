/// The dashboard dock's macro rows: one labelled bar per macro, with the
/// current/target gram readout pinned to a shared right column.
///
/// Split out of `today_section.dart`, which is far over the widget-file line
/// limit — and was therefore frozen by the size ratchet, so the gram readout's
/// overflow could not be fixed in place.
library;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../logic/dashboard_spacing.dart';

class MacroBarData {
  const MacroBarData(this.label, this.current, this.target, this.color);
  final String label;
  final int current;
  final int target;
  final Color color;
}

class MacroRow extends StatelessWidget {
  const MacroRow({super.key, required this.bar, required this.idx});
  final MacroBarData bar;
  final int idx;

  @override
  Widget build(BuildContext context) {
    final pct =
        bar.target > 0
            ? ((bar.current / bar.target) * 100).clamp(0, 100).toDouble()
            : 0.0;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 72,
          child: Text(
            bar.label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.visible,
            softWrap: false,
            style: dashMeta(color: kInk),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(child: _MacroBar(pct: pct, color: bar.color, idx: idx)),
        const SizedBox(width: NhamSpacing.sp3),
        // Fixed-width right column so every bar ends at the same x and the
        // values line up (shared with the meal-row kcal column).
        SizedBox(
          width: dashboardValueColumnWidth,
          // Scale down rather than wrap or clip. At the app's 1.3 Dynamic Type
          // cap `1024/350g` no longer fits: wrapping grows the row and breaks
          // the shared right edge, and clipping turns it into "1024/35" — a
          // number that reads as real and is wrong. Same treatment as the
          // logging feed's macro summary.
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerRight,
            child: Text(
              '${bar.current}/${bar.target}g',
              maxLines: 1,
              softWrap: false,
              textAlign: TextAlign.right,
              style: dashMeta(color: kInk, tabular: true),
            ),
          ),
        ),
      ],
    );
  }
}

/// One macro bar fill: h-2 (8px) track, fill animates 0 → pct over 900ms with
/// a per-bar stagger (idx*100 + 200ms lead-in) and the signature ease.
class _MacroBar extends StatefulWidget {
  const _MacroBar({required this.pct, required this.color, required this.idx});
  final double pct;
  final Color color;
  final int idx;

  @override
  State<_MacroBar> createState() => _MacroBarState();
}

class _MacroBarState extends State<_MacroBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late Animation<double> _fill = _build();

  static const Curve _ease = Cubic(0.16, 1, 0.3, 1);

  Animation<double> _build() => Tween<double>(
    begin: 0,
    end: widget.pct,
  ).animate(CurvedAnimation(parent: _c, curve: _ease));

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.idx * 100 + 200), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(_MacroBar old) {
    super.didUpdateWidget(old);
    if (old.pct != widget.pct) {
      _fill = _build();
      _c
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Reduced motion: render the fill at its resting width, no sweep.
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.pill),
      child: Container(
        height: 8, // h-2
        color: kTrack,
        child: LayoutBuilder(
          builder:
              (context, constraints) => AnimatedBuilder(
                animation: _fill,
                builder:
                    (context, _) => Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width:
                            constraints.maxWidth *
                            ((reduceMotion ? widget.pct : _fill.value) / 100),
                        height: 8,
                        decoration: BoxDecoration(
                          color: widget.color,
                          borderRadius: BorderRadius.circular(NhamRadii.pill),
                        ),
                      ),
                    ),
              ),
        ),
      ),
    );
  }
}
