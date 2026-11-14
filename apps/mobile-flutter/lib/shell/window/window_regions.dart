import 'package:flutter/widgets.dart';

import 'window_layout.dart';

/// Overlay geometry stays in window coordinates even inside a sheet route.
class WindowRegions {
  const WindowRegions(this.layout);
  final WindowLayout layout;

  bool get laptop => layout.foldAcross;

  Rect get safe => Rect.fromLTRB(
    layout.viewPadding.left,
    0,
    layout.size.width - layout.viewPadding.right,
    layout.size.height,
  );

  Rect paneFor(double x) {
    if (!layout.twoPane) return safe;
    return x < layout.foldX
        ? Rect.fromLTRB(
          safe.left,
          0,
          layout.foldX - kFoldGutter / 2,
          safe.bottom,
        )
        : Rect.fromLTRB(
          layout.foldX + kFoldGutter / 2,
          0,
          safe.right,
          safe.bottom,
        );
  }

  Rect get near =>
      layout.twoPane
          ? paneFor(
            layout.controlEdge == ControlEdge.left ? safe.left : safe.right,
          )
          : safe;

  Rect get dialog =>
      laptop
          ? Rect.fromLTRB(
            safe.left,
            layout.viewPadding.top,
            safe.right,
            layout.size.height / 2 - kFoldGutter / 2,
          )
          : near;

  EdgeInsets insets(Rect rect) => EdgeInsets.fromLTRB(
    rect.left,
    rect.top,
    layout.size.width - rect.right,
    layout.size.height - rect.bottom,
  );
}
