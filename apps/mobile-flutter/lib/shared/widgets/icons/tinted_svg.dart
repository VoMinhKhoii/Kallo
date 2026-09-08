import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// An inline SVG drawn SQUARE at [size] in one flat tint.
///
/// The shape every single-colour glyph in the app takes: the source string
/// carries a placeholder fill (`#000`, `currentColor`) and a `srcIn` filter
/// repaints every path in [color], so one string serves ink, danger and
/// whatever the caller passes. Inline strings rather than assets, so a glyph is
/// renderable without pubspec registration.
///
/// Only for glyphs that are square and one colour. A multi-colour mark
/// (`brand/google_logo.dart`) has no tint to apply, and a mark sized from its
/// viewBox ratio (`brand/kallo_mark.dart`, `brand/kallo_wordmark.dart`) has a
/// width that is not its height — both keep their own `SvgPicture.string`.
class TintedSvg extends StatelessWidget {
  const TintedSvg({
    required this.svg,
    required this.size,
    required this.color,
    this.semanticsLabel,
    this.excludeFromSemantics = false,
    super.key,
  });

  /// The SVG source. A `const` string on the widget that owns the glyph.
  final String svg;

  /// Both the width and the height.
  final double size;

  /// The one tint every path is repainted in.
  final Color color;

  /// What a screen reader calls the glyph. Null when the glyph is decorative —
  /// then say so with [excludeFromSemantics], so it is skipped rather than
  /// announced as an unlabelled image.
  final String? semanticsLabel;
  final bool excludeFromSemantics;

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    svg,
    width: size,
    height: size,
    colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    semanticsLabel: semanticsLabel,
    excludeFromSemantics: excludeFromSemantics,
  );
}
