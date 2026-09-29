import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import 'tab_layout.dart';

/// A Circle tab's name: ink when open, muted when not, with the unread dot
/// after it on a closed tab — small and raised, like a superscript, so it
/// reads as a mark on the name rather than a second item. The open tab draws
/// no dot: the viewer is reading it.
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
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      AnimatedDefaultTextStyle(
        duration: KalloMotion.quick,
        style: dashBody(color: selected ? kInk : kInkMuted),
        child: Text(label, maxLines: 1),
      ),
      if (unread && !selected)
        const Padding(
          padding: EdgeInsets.only(left: TabGeometry.dotGap, top: 2),
          child: DecoratedBox(
            key: Key('circle-unread-dot'),
            decoration: BoxDecoration(color: kInk, shape: BoxShape.circle),
            child: SizedBox.square(dimension: TabGeometry.dotSize),
          ),
        ),
    ],
  );
}
