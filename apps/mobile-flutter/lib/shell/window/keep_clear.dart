import 'package:flutter/widgets.dart';

import 'keep_clear_zones.dart';
import 'render_keep_clear.dart';

/// How a piece of a column-free page gives way to a keep-clear corner
/// (`WindowLayout.keepClear`) that it would otherwise reach into.
enum KeepClearMode {
  /// On the column's side only: a header row's corner glyph, a title or a
  /// line that wraps before the column, a mascot's speech bubble.
  side,

  /// On both sides by the same amount, so it stays centred: a progress bar,
  /// a toggle, centred text, a pinned button.
  centred,

  /// Down, so it starts below the top corner: a full-width field or card.
  /// A bottom corner is left to the pieces inside it, which may be a whole
  /// block (the sign-in options) whose last lines alone reach it.
  below,
}

/// Keeps [child] out of the control column's keep-clear corners on a
/// column-free page (`ColumnFreePage`), and does nothing anywhere else.
///
/// Whether a piece is beside a corner depends on where the page puts it,
/// which only layout knows, so this measures itself once laid out and, if it
/// reaches into a corner, gives way from the next frame. Giving way on a side
/// never moves it out of the corner again (the row keeps its width and only
/// grows taller), so it settles. [KeepClearMode.below] needs a parent that
/// lets the piece move down, one that lays out from the top or centres it:
/// in a bottom-anchored parent the piece cannot move and its inset would
/// grow every frame. Inside a scroll view
/// it measures where it sits at rest: scrolled content that rises into a
/// corner is hidden there by [KeepClearClip], not re-laid out.
///
/// It must be given a tight width, as a stretched row of a column is.
class KeepClear extends SingleChildRenderObjectWidget {
  const KeepClear({
    super.key,
    this.mode = KeepClearMode.side,
    required Widget super.child,
  });

  final KeepClearMode mode;

  @override
  RenderKeepClear createRenderObject(BuildContext context) => RenderKeepClear(
    mode: mode,
    zones: keepClearZones(context),
    scroll: Scrollable.maybeOf(context)?.position,
  );

  @override
  void updateRenderObject(BuildContext context, RenderKeepClear renderObject) =>
      renderObject
        ..mode = mode
        ..zones = keepClearZones(context)
        ..scroll = Scrollable.maybeOf(context)?.position;
}
