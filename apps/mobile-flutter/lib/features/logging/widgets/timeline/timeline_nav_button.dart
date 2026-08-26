import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';

/// The chevron either side of the week strip — a quiet icon that dips while
/// held and dims when there is nowhere further to page.
///
/// Its own file because it is a press affordance, not week arithmetic: the
/// strip is about anchors, pages and which day is selected, and this shares
/// none of that.

class TimelineNavButton extends StatefulWidget {
  const TimelineNavButton({
    super.key,required this.icon, required this.color, this.onTap});

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  State<TimelineNavButton> createState() => TimelineNavButtonState();
}

class TimelineNavButtonState extends State<TimelineNavButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: KalloMotion.press,
        curve: KalloEase.press,
        child: Container(
          width: 36, // w-9
          height: 40, // h-10
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _pressed ? KalloColors.hover40 : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
          ),
          child: Icon(widget.icon, size: 16, color: widget.color),
        ),
      ),
    );
  }
}
