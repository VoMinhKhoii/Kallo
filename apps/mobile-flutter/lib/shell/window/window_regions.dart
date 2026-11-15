import 'package:flutter/widgets.dart';

import 'window_layout.dart';

/// Overlay geometry stays in window coordinates even inside a sheet route.
class WindowRegions {
  const WindowRegions(this.layout);
  final WindowLayout layout;

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
      layout.twoPane ? paneFor(layout.nearLeft ? safe.left : safe.right) : safe;

  Rect get far =>
      layout.twoPane ? paneFor(layout.nearLeft ? safe.right : safe.left) : safe;

  Rect get dialog =>
      layout.foldAcross
          ? Rect.fromLTRB(
            safe.left,
            layout.viewPadding.top,
            safe.right,
            layout.size.height / 2 - kFoldGutter / 2,
          )
          : near;

  /// Sheets stay beside the controls and clear the horizontal fold when the
  /// keyboard is down. The keyboard itself occupies that lower half when up.
  ({
    EdgeInsets padding,
    double maxWidth,
    double maxHeight,
    BorderRadius corners,
  })
  sheetFrame({required double keyboardInset, required double radius}) {
    final frame = near;
    final maxWidth = layout.foldAcross ? 560.0 : 640.0;
    final centered = frame.width > maxWidth;
    final height =
        layout.foldAcross && keyboardInset == 0
            ? layout.size.height / 2 - kFoldGutter / 2
            : layout.size.height - keyboardInset - 12;
    return (
      padding: EdgeInsets.fromLTRB(
        frame.left,
        0,
        layout.size.width - frame.right,
        keyboardInset,
      ),
      maxWidth: maxWidth,
      maxHeight: height.clamp(0, double.infinity),
      corners: BorderRadius.only(
        topLeft: Radius.circular(radius),
        topRight: Radius.circular(radius),
        bottomLeft: Radius.circular(frame.left > 0 || centered ? radius : 0),
        bottomRight: Radius.circular(
          frame.right < layout.size.width || centered ? radius : 0,
        ),
      ),
    );
  }

  /// The dialog route supplies its real available width; a caller may have
  /// narrowed MediaQuery to text settings only. Wide windows use 270pt.
  ({EdgeInsets padding, double maxWidth}) dialogFrame(
    double compactMaxWidth,
  ) => (
    padding: insets(dialog),
    maxWidth:
        layout.hasControlColumn || layout.regularWidth ? 270 : compactMaxWidth,
  );

  EdgeInsets insets(Rect rect) => EdgeInsets.fromLTRB(
    rect.left,
    rect.top,
    layout.size.width - rect.right,
    layout.size.height - rect.bottom,
  );
}
