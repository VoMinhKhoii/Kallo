import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'tinted_svg.dart';

/// The Lucide `heart` glyph, filled — for the hearted state. Lucide is an icon
/// FONT here, so `Icon(fill:)` cannot fill it (the font carries no FILL axis
/// and the parameter is silently a no-op); this is the same 24-grid path drawn
/// as an inline SVG with a fill, which is what the web's lucide-react
/// `<Heart fill>` does. Stroke 1.5 matches the 300 weight of the outline glyph
/// beside it. Drawn by [TintedSvg], like every other one-colour glyph.
class FilledHeart extends StatelessWidget {
  const FilledHeart({
    this.size = KalloIcons.tertiary,
    this.color = KalloColors.danger,
    super.key,
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => TintedSvg(
    svg: _svg,
    size: size,
    color: color,
    // The outline heart beside it carries the label; this is the same glyph
    // in its other state, not a second thing to announce.
    excludeFromSemantics: true,
  );
}

/// Parses the filled heart AHEAD of the first tap, into flutter_svg's own
/// cache, under the key [FilledHeart]'s [SvgPicture.string] will look under.
///
/// `SvgPicture.string` parses its source the first time the glyph is built —
/// and on the Circle feed that moment is the tap that hearts a post, so the
/// fill landed a frame or two late on the one interaction the surface is
/// built around. Warming at page load makes the hearted state a repaint of
/// something already decoded.
///
/// Idempotent, and cheap to call again: `putIfAbsent` hands back the entry —
/// pending or decoded — for a key the cache already holds, so only the first
/// caller in the process pays for the parse. [SvgStringLoader] keys by the
/// source string, so this is the same entry the widget resolves to (the app
/// installs no `DefaultSvgTheme`, so the null context here reads the same
/// default theme the widget's context does).
void precacheFilledHeart() {
  const loader = SvgStringLoader(_svg);
  svg.cache.putIfAbsent(loader.cacheKey(null), () => loader.loadBytes(null));
}

const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000" stroke="#000" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 3 8.5c0 2.3 1.5 4.05 3 5.5l6 6Z"/></svg>';
