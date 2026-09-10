import 'package:flutter/widgets.dart';

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
    required this.size,
    this.color = KalloColors.danger,
    super.key,
  });

  /// Required, with no default: this glyph is the ON state of an outline that
  /// is optically compensated per glyph ([KalloIcons.optical]), and the two
  /// must be the same size or the post twitches as it is hearted. A tier
  /// default here was a size nothing rendered and an invitation to mismatch.
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

/// Parses the filled heart ahead of the first tap — see [precacheTintedSvg]
/// for the cache-key reasoning. Called once at app start (`main.dart`): the
/// warm is process-global and has nothing to do with any one feed's lifecycle.
void precacheFilledHeart() => precacheTintedSvg(_svg);

const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000" stroke="#000" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 3 8.5c0 2.3 1.5 4.05 3 5.5l6 6Z"/></svg>';
