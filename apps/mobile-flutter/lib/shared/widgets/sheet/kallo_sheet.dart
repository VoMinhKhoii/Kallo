import 'package:flutter/material.dart';

import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_regions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_shapes.dart';
import 'sheet_content_inset.dart';

export 'sheet_content_inset.dart';

/// The line every sheet's content starts on, header and body alike.
const double kSheetContentInset = KalloSpacing.sp4; // 16

/// A sheet's top corner radius: CONCENTRIC with its header controls. The
/// 36pt grey circle sits [kSheetContentInset] in from the side and the top,
/// so its centre is 16 + 18 = 34pt from the corner — and a 34pt corner keeps
/// the same gap to the circle all the way round the curve. At the old 22 the
/// gap pinched on the diagonal (owner review, 2026-09-28).
const double kSheetRadius = kSheetContentInset + 18; // 34

/// Opens a modal sheet with the standard transparent-background chrome — the
/// surface itself is painted by [KalloSheetSurface], which the [builder] returns.
///
/// [isScrollControlled] defaults to TRUE. Material's default caps a sheet at
/// 9/16 of the screen and clips the rest, taking the action row off-screen —
/// the three sheets that hadn't opted out all overflowed on a short phone or in
/// landscape. Safe by default now. Sizing to content is only half of it: see
/// [KalloSheetSurface.scrollable]. Guarded by `test/shared/sheet_overflow_test.dart`.
///
/// Root navigator ownership is TRUE and not optional. Opened from a shell BRANCH
/// screen (Circle, Nutrition, …) the nearest navigator is the branch's own,
/// which lives inside the shell Scaffold's `body` — and a Scaffold paints its
/// `bottomNavigationBar` after the body, so the pill nav sat ON TOP of the
/// open sheet: it covered Circle's create-group CTA, and a tap on it switched
/// tabs behind the sheet. Pushing onto the root navigator puts the sheet above
/// the whole shell. `Navigator.of(sheetContext).pop()` inside a sheet still
/// dismisses it — that context sits under the sheet's own route, which is now
/// the root navigator's. Guarded by `test/shell/pill_nav_test.dart`.
Future<T?> showNhamSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  Color? barrierColor,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: Colors.transparent,
    // The surface owns horizontal placement, including the fold-side pane.
    constraints: const BoxConstraints(maxWidth: double.infinity),
    barrierColor: barrierColor,
    useRootNavigator: true,
    builder: builder,
  );
}

/// Shared chrome for every modal bottom sheet: one solid surface, rounded at
/// [kSheetRadius], and one KalloSheetHeader stop hand-rolled sheets diverging.
/// The window frame bounds the surface; callers keep their own body and height
/// mechanics. Callers pass their own [constraints] (max-height slice) and,
/// optionally, [padding] for content-hugging sheets.
///
/// Set [scrollable] on a sheet whose body is a plain content [Column] with no
/// scroll view of its own: it caps the surface at [maxHeightFraction] and lets
/// the body scroll past that, keeping the action row reachable on a short
/// phone, at 1.3x Dynamic Type, and in landscape. Sheets that already own a
/// `ListView`/`SingleChildScrollView` must NOT set it — two nested scrollables.
///
/// **The keyboard is handled HERE, once.** `showModalBottomSheet` does not do
/// it, so every sheet with a field was paying for it by hand — five did it as
/// an outer padding, three folded it into an inner scroll view, and
/// `group_info_sheet` (inline rename + member search) simply did not, so the
/// keyboard covered both of its fields. The surface now lifts itself clear of
/// `viewInsets` and takes the keyboard out of its own height cap, which is the
/// other half: a 0.9-of-SCREEN cap while the keyboard owns 300pt of that
/// screen is an overflow waiting for a short phone. Sheets must NOT re-apply
/// the inset on top of this.
class KalloSheetSurface extends StatelessWidget {
  const KalloSheetSurface({
    super.key,
    required this.child,
    this.constraints,
    this.padding,
    this.clipBehavior = Clip.none,
    this.scrollable = false,
    this.maxHeightFraction = 0.9,
    this.color,
  });

  final Widget child;
  final BoxConstraints? constraints;
  final EdgeInsetsGeometry? padding;
  final Clip clipBehavior;

  /// Wraps [child] in a scroll view under a screen-height cap. See the class doc.
  final bool scrollable;

  /// Height cap for [scrollable], as a fraction of the screen. 0.9 leaves the
  /// barrier tappable so the sheet never reads as a full-screen page.
  final double maxHeightFraction;

  /// [KalloColors.sheet] by default — white in light. A sheet whose body is itself made of
  /// white grouped cards (the scan result) paints the canvas colour instead,
  /// so the cards separate by surface the way they do on a page.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final frame = WindowRegions(
      WindowLayout.of(context),
    ).sheetFrame(keyboardInset: keyboardInset, radius: kSheetRadius);
    var effective = constraints;
    var body = child;
    if (scrollable) {
      effective ??= BoxConstraints(
        maxHeight:
            (MediaQuery.sizeOf(context).height - keyboardInset) *
            maxHeightFraction,
      );
      // shrinkWrap semantics: the sheet still hugs its content and only
      // scrolls once the content exceeds the cap.
      body = SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        child: child,
      );
    }
    effective = (effective ?? const BoxConstraints()).enforce(
      BoxConstraints(maxHeight: frame.maxHeight),
    );
    // OUTSIDE the decoration: the surface has to end where the keyboard
    // begins, not merely inset its contents and paint white behind it.
    return Padding(
      padding: frame.padding,
      child: Align(
        alignment: Alignment.bottomCenter,
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: frame.maxWidth),
          child: Container(
            constraints: effective,
            padding: padding,
            clipBehavior: clipBehavior,
            // A squircle, not a rounded rect: the top corners ramp their
            // curvature the way every iOS sheet's do. `ShapeDecoration` is what
            // takes a `ShapeBorder` — note it spells shadows `shadows`.
            decoration: ShapeDecoration(
              color: color ?? KalloColors.sheet,
              shape: KalloShapes.squircleCorners(frame.corners),
              // Sheets are TRUE elevation on the borderless-card canvas.
              shadows: kSheetShadows,
            ),
            // Published INSIDE the padding, so the header it reaches is measuring
            // the same content column its neighbours sit in.
            child: SheetContentInset(
              horizontal:
                  padding?.resolve(Directionality.of(context)).left ?? 0,
              child: MediaQuery.removePadding(
                context: context,
                removeLeft: true,
                removeRight: true,
                child: body,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
