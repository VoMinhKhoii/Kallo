import 'package:flutter/widgets.dart';

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
