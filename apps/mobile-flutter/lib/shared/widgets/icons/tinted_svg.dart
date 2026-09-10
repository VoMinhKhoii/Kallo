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

/// Parses [svgSource] into `flutter_svg`'s cache ahead of the frame that first
/// draws it.
///
/// The parse is synchronous on the UI thread, so an inline SVG swapped in on a
/// tap — the Circle heart filling — landed a frame or two late on the one
/// interaction its surface is built around. Warming at app start makes that
/// swap a repaint of something already decoded.
///
/// Idempotent, and cheap to call again: `putIfAbsent` hands back the entry —
/// pending or decoded — for a key the cache already holds, so only the first
/// caller in the process pays for the parse. [SvgStringLoader] keys by the
/// source string, so this is the same entry [TintedSvg] resolves to (the app
/// installs no `DefaultSvgTheme`, so the null context here reads the same
/// default theme the widget's context does).
///
/// It lives beside [TintedSvg] rather than beside any one glyph: the cache key
/// and the null-context reasoning are properties of THIS seam, and the second
/// glyph that wants warming should not have to rediscover them.
void precacheTintedSvg(String svgSource) {
  final loader = SvgStringLoader(svgSource);
  svg.cache.putIfAbsent(loader.cacheKey(null), () => loader.loadBytes(null));
}
