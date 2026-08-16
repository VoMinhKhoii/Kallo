import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A single macro bar whose fill sweeps 0→pct (1000ms, delay 200ms, easeOut).
class MacroBar extends StatefulWidget {
  const MacroBar({super.key, required this.pct, required this.color});
  final double pct;
  final Color color;

  @override
  State<MacroBar> createState() => _MacroBarState();
}

class _MacroBarState extends State<MacroBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late Animation<double> _anim = _build(0, widget.pct);

  Animation<double> _build(double from, double to) => Tween<double>(
    begin: from,
    end: to,
  ).chain(CurveTween(curve: Curves.easeOut)).animate(_c);

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(MacroBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pct != widget.pct) {
      _anim = _build(_anim.value, widget.pct);
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
      borderRadius: BorderRadius.circular(KalloRadii.pill),
      child: Container(
        height: 6, // h-1.5
        color: KalloColors.track,
        child: AnimatedBuilder(
          animation: _anim,
          builder:
              (context, _) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: ((reduceMotion ? widget.pct : _anim.value) / 100)
                    .clamp(0, 1),
                child: Container(
                  decoration: BoxDecoration(
                    color: widget.color,
                    borderRadius: BorderRadius.circular(KalloRadii.pill),
                  ),
                ),
              ),
        ),
      ),
    );
  }
}
