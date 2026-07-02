import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';

/// The warm gradient initials disc used across Circle surfaces (wall card,
/// member list, connect screen). Mirrors the web `.from-nham-accent/40
/// .to-nham-border/55 .ring-nham-accent/25` avatar with a bold umber initial.
class CircleInitialsAvatar extends StatelessWidget {
  const CircleInitialsAvatar({
    required this.initial,
    this.size = 24,
    super.key,
  });

  final String initial;
  final double size;

  @override
  Widget build(BuildContext context) {
    // Initial scales with the disc: ~42% of the diameter, matching the web
    // ratios (10px @ 24, 13px @ 36, 24px @ 64).
    final fontSize = (size * 0.42).clamp(10.0, 26.0);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [NhamColors.accent40, NhamColors.borderHalf],
        ),
        border: Border.all(color: const Color(0x40C9A87C)), // accent @ 25%
      ),
      child: Text(
        initial,
        style: NhamTextStyles.sansBold(fontSize: fontSize).copyWith(
          color: NhamColors.btn,
        ),
      ),
    );
  }
}
