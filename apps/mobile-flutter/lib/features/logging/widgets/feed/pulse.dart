import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';

/// A continuously pulsing wrapper (Tailwind animate-pulse: opacity 1→.5→1 over
/// 2s cubic-bezier(0.4,0,0.6,1)).
class Pulse extends StatefulWidget {
  const Pulse({super.key, required this.child});
  final Widget child;

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2000),
  )..repeat(reverse: true);
  late final Animation<double> _opacity = Tween<double>(
    begin: 0.5,
    end: 1,
  ).animate(CurvedAnimation(parent: _c, curve: const Cubic(0.4, 0, 0.6, 1)));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: hold the skeleton fully visible instead of looping.
    if (MediaQuery.disableAnimationsOf(context)) {
      _c
        ..stop()
        ..value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: _opacity, child: widget.child);
}

/// The one shape every logging skeleton is drawn from: a pill-rounded bar.
Widget skeletonBar(double width, double height, Color color) => Container(
  width: width,
  height: height,
  decoration: BoxDecoration(
    color: color,
    borderRadius: BorderRadius.circular(KalloRadii.pill),
  ),
);
