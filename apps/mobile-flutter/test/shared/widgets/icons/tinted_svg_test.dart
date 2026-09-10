import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/icons/tinted_svg.dart';

/// The one thing every caller relies on: the glyph's own fills are thrown away
/// and the whole path is repainted in the tint it was handed. A `srcIn` filter
/// is what does that — anything else (`srcATop`, no filter at all) would leave
/// the source `#000` showing.
const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    '<path fill="#000" d="M4 4h16v16H4Z"/></svg>';

void main() {
  testWidgets('renders the svg tinted srcIn at the given size', (tester) async {
    const tint = Color(0xFFB00020);

    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: TintedSvg(svg: _svg, size: 18, color: tint)),
      ),
    );

    final picture = tester.widget<SvgPicture>(find.byType(SvgPicture));
    expect(picture.width, 18);
    expect(picture.height, 18);
    expect(
      picture.colorFilter,
      const ColorFilter.mode(tint, BlendMode.srcIn),
      reason: 'the tint must REPLACE the source fills, not blend with them',
    );
    expect(tester.getSize(find.byType(SvgPicture)), const Size(18, 18));
  });
}
