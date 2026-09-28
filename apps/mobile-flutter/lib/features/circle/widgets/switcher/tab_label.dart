import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';

/// A Circle tab's name: ink when open, muted when not, with the unread dot
/// after it on a closed tab. The open tab draws no dot — the viewer is
/// reading it.
class TabLabel extends StatelessWidget {
  const TabLabel({
    required this.label,
    required this.selected,
    required this.unread,
    super.key,
  });

  final String label;
  final bool selected;
  final bool unread;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      AnimatedDefaultTextStyle(
        duration: KalloMotion.quick,
        style: dashBody(color: selected ? kInk : kInkMuted),
        child: Text(label, maxLines: 1),
      ),
      if (unread && !selected) ...[
        const SizedBox(width: KalloSpacing.sp1),
        const DecoratedBox(
          key: Key('circle-unread-dot'),
          decoration: BoxDecoration(color: kInk, shape: BoxShape.circle),
          child: SizedBox.square(dimension: 7),
        ),
      ],
    ],
  );
}
