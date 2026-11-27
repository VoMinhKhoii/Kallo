import 'package:flutter/widgets.dart';

import '../../window/window_layout.dart';

/// The window less its control column.
class OutsideColumn extends CustomClipper<Rect> {
  const OutsideColumn(this.layout);
  final WindowLayout layout;

  @override
  Rect getClip(Size size) => switch (layout.controlEdge) {
    ControlEdge.bottom => Offset.zero & size,
    ControlEdge.left => Rect.fromLTRB(
      layout.columnWidth,
      0,
      size.width,
      size.height,
    ),
    ControlEdge.right => Rect.fromLTRB(
      0,
      0,
      size.width - layout.columnWidth,
      size.height,
    ),
  };

  @override
  bool shouldReclip(OutsideColumn oldClipper) => oldClipper.layout != layout;
}
