import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The Lucide `heart` glyph, filled — for the hearted state. Lucide is an icon
/// FONT here, so `Icon(fill:)` cannot fill it (the font carries no FILL axis
/// and the parameter is silently a no-op); this is the same 24-grid path drawn
/// as an inline SVG with a fill, which is what the web's lucide-react
/// `<Heart fill>` does. Stroke 1.5 matches the 300 weight of the outline glyph
/// beside it. Pattern: `brand/kallo_mark.dart`.
class FilledHeart extends StatelessWidget {
  const FilledHeart({
    this.size = KalloIcons.tertiary,
    this.color = KalloColors.danger,
    super.key,
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    _svg,
    width: size,
    height: size,
    colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    excludeFromSemantics: true,
  );
}

const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000" stroke="#000" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 3 8.5c0 2.3 1.5 4.05 3 5.5l6 6Z"/></svg>';
