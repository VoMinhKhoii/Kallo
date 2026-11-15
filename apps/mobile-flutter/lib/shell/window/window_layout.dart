import 'package:flutter/widgets.dart';
import 'window_layout_scope.dart';

/// Where the window keeps its controls.
///
/// iPhone Duo's outer display, and its inner display in landscape, hold the
/// status bar and the system's bars in a column down one side instead of
/// across the top and bottom. Our tab pill follows them there.
enum ControlEdge { bottom, left, right }

/// How lopsided the side insets must be before one of them is a control
/// column.
///
/// A classic iPhone in landscape reports the SAME inset on both sides (the
/// sensor housing mirrored for symmetry, about 62pt each). Duo reports 84pt on
/// the column's side and 0 on the other. Comparing the two sides tells them
/// apart without naming a device; 40 sits well clear of both the rounding in
/// the first case and the 84 in the second.
const double kControlColumnMinAsymmetry = 40;

/// The narrowest content area that gets a regular-width layout.
///
/// Every iPhone in portrait, Duo's outer display (466, less its column) and
/// one half of Duo's Split View are under it; Duo's inner display is over it
/// in both orientations. The same line Flutter draws between a bottom bar and
/// a rail.
const double kRegularWidth = 600;

/// The shortest window that still counts as regular height. A phone on its
/// side and Duo's outer display in landscape are under it.
const double kRegularHeight = 500;

/// The narrowest window that splits into two panes. Duo's inner display in
/// landscape (951) clears it; the same display in portrait (669) does not, and
/// keeps one bounded column.
const double kTwoPaneWidth = 840;

/// The shortest window with a control column that still splits in two. Under
/// a pinned video Duo's inner display is wide and short, and its fold is still
/// there: one column would put the composer and the buttons on it.
const double kTwoPaneMinHeight = 360;

/// Width of the strip down the centre of a two-pane window that holds no
/// content: the fold. The Flutter engine measured the fold's reserved frame at
/// 40pt on the Duo simulator (flutter/flutter#193025), protective margins
/// included.
const double kFoldGutter = 40;

/// What the current window's size and safe-area insets ask of the layout.
///
/// Resolved from the window alone — never from the device, its idiom or its
/// orientation — because on Duo the same app moves between a compact outer
/// display, a regular inner one, half of a Split View and a strip under a
/// pinned video, and may do so mid-session.
@immutable
class WindowLayout {
  const WindowLayout({
    required this.size,
    required this.viewPadding,
    required this.controlEdge,
  });

  factory WindowLayout.resolve(Size size, EdgeInsets viewPadding) {
    final lean = viewPadding.right - viewPadding.left;
    final edge =
        lean >= kControlColumnMinAsymmetry
            ? ControlEdge.right
            : lean <= -kControlColumnMinAsymmetry
            ? ControlEdge.left
            : ControlEdge.bottom;
    return WindowLayout(
      size: size,
      viewPadding: viewPadding,
      controlEdge: edge,
    );
  }

  /// Keeps window geometry through pane-local inset removal, rebuilding when
  /// the inherited window changes. Unscoped callers read MediaQuery directly.
  static WindowLayout of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<WindowLayoutScope>()?.layout ??
      WindowLayout.resolve(
        MediaQuery.sizeOf(context),
        MediaQuery.viewPaddingOf(context),
      );

  final Size size;

  /// The system's persistent insets. `viewPadding`, not `padding`: the
  /// keyboard must not change where the controls live.
  final EdgeInsets viewPadding;

  final ControlEdge controlEdge;

  /// True when the system's controls run down a side of the window.
  bool get hasControlColumn => controlEdge != ControlEdge.bottom;

  /// Width of the control column, 0 when the controls sit on the bottom.
  double get columnWidth => switch (controlEdge) {
    ControlEdge.left => viewPadding.left,
    ControlEdge.right => viewPadding.right,
    ControlEdge.bottom => 0,
  };

  /// Width left for content once both side insets are taken out.
  double get contentWidth => size.width - viewPadding.horizontal;

  bool get regularWidth => contentWidth >= kRegularWidth;

  bool get compactHeight => size.height < kRegularHeight;

  /// Two panes either side of the fold: wide enough for both, and tall enough
  /// that neither is a letterbox.
  ///
  /// A short window splits only where there is a control column, which is to
  /// say only where there is a fold to keep clear. A classic phone on its side
  /// is just as wide and has no fold, so it keeps one bounded column.
  bool get twoPane =>
      regularWidth &&
      size.width >= kTwoPaneWidth &&
      (hasControlColumn ? size.height >= kTwoPaneMinHeight : !compactHeight);

  /// One regular-width column with the fold running ACROSS it: Duo's inner
  /// display held tall, where the lower half is the base of a laptop. Pinned
  /// controls, sheets and dialogs keep out of the band at mid-height. A phone
  /// on its side is regular width too, but far too short to be this.
  bool get foldAcross =>
      regularWidth && !twoPane && !hasControlColumn && !compactHeight;

  /// The fold's x in window coordinates. It runs down the centre of the
  /// DISPLAY, so with a control column on one side it is off-centre in the
  /// content area, and the two panes are unequal.
  double get foldX => size.width / 2;

  @override
  bool operator ==(Object other) =>
      other is WindowLayout &&
      other.size == size &&
      other.viewPadding == viewPadding;

  @override
  int get hashCode => Object.hash(size, viewPadding);
}
