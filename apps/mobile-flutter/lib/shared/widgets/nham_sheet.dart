import 'package:flutter/material.dart';

import '../../theme/calm_tokens.dart';

/// Shared chrome for every modal bottom sheet in the app.
///
/// One surface (solid white, top-rounded at [kCardRadius]) and one header
/// (`NhamSheetHeader`, in nham_sheet_header.dart) so the hand-rolled sheets
/// stop diverging. Callers keep their own body and height mechanics.

/// Opens a modal sheet with the standard transparent-background chrome — the
/// surface itself is painted by [NhamSheetSurface], which the [builder] returns.
///
/// [isScrollControlled] defaults to TRUE. Material's default caps a sheet at
/// 9/16 of the screen and clips the rest, taking the action row off-screen —
/// the three sheets that hadn't opted out all overflowed on a short phone or in
/// landscape. Safe by default now. Sizing to content is only half of it: see
/// [NhamSheetSurface.scrollable]. Guarded by `test/sheet_overflow_test.dart`.
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
class NhamSheetSurface extends StatelessWidget {
  const NhamSheetSurface({
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
    var effective = constraints;
    var body = child;
    if (scrollable) {
      effective ??= BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * maxHeightFraction,
      );
      // shrinkWrap semantics: the sheet still hugs its content and only
      // scrolls once the content exceeds the cap.
      body = SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        child: child,
      );
    }
    return Container(
      constraints: effective,
      padding: padding,
      clipBehavior: clipBehavior,
      decoration: const BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(kCardRadius)),
      ),
      child: body,
    );
  }
}
