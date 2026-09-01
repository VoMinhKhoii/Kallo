import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The line every sheet's content starts on, header and body alike.
const double kSheetContentInset = KalloSpacing.sp4; // 16

/// How much horizontal inset the surface has ALREADY applied to its body.
///
/// Exists so [KalloSheetHeader] can inherit the sheet's inset instead of
/// hardcoding one. Sheets split into two camps: most hand
/// [KalloSheetSurface] a `padding` and let their rows sit flush inside it,
/// while the full-bleed ones (the scan sheet's camera frame) pad nothing and
/// let each body step inset itself. A header that always added its own 16
/// was right for the second camp and 32pt — a full inset too far — for the
/// first, which is why the X sat visibly right of the row icons directly
/// under it on the Add sheet.
class SheetContentInset extends InheritedWidget {
  const SheetContentInset({
    required this.horizontal,
    required super.child,
    super.key,
  });

  /// Horizontal padding the surface applies around [child].
  final double horizontal;

  /// 0 when read outside a [KalloSheetSurface] — the header then owns the
  /// whole inset, which is the standalone case its own test renders.
  static double of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<SheetContentInset>()
          ?.horizontal ??
      0;

  @override
  bool updateShouldNotify(SheetContentInset oldWidget) =>
      oldWidget.horizontal != horizontal;
}

/// Shared chrome for every modal bottom sheet in the app.
///
/// One surface (solid white, top-rounded at [kCardRadius]) and one header
/// (`KalloSheetHeader`, in kallo_sheet_header.dart) so the hand-rolled sheets
/// stop diverging. Callers keep their own body and height mechanics.

/// Opens a modal sheet with the standard transparent-background chrome — the
/// surface itself is painted by [KalloSheetSurface], which the [builder] returns.
///
/// [isScrollControlled] defaults to TRUE. Material's default caps a sheet at
/// 9/16 of the screen and clips the rest, taking the action row off-screen —
/// the three sheets that hadn't opted out all overflowed on a short phone or in
/// landscape. Safe by default now. Sizing to content is only half of it: see
/// [KalloSheetSurface.scrollable]. Guarded by `test/sheet_overflow_test.dart`.
///
/// [useRootNavigator] is TRUE and not optional. Opened from a shell BRANCH
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
    barrierColor: barrierColor,
    useRootNavigator: true,
    builder: builder,
  );
}

/// The standard sheet surface: solid white, top corners rounded at the calm
/// card radius. Callers pass their own [constraints] (max-height slice) and,
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

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
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
    // OUTSIDE the decoration: the surface has to end where the keyboard
    // begins, not merely inset its contents and paint white behind it.
    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: Container(
        constraints: effective,
        padding: padding,
        clipBehavior: clipBehavior,
        decoration: const BoxDecoration(
          color: kCardSurface,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(kCardRadius),
          ),
          // Sheets are TRUE elevation on the borderless-card canvas.
          boxShadow: kSheetShadows,
        ),
        // Published INSIDE the padding, so the header it reaches is measuring
        // the same content column its neighbours sit in.
        child: SheetContentInset(
          horizontal: padding
                  ?.resolve(Directionality.of(context))
                  .left ??
              0,
          child: body,
        ),
      ),
    );
  }
}
