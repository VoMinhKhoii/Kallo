import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/icons/filled_heart.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The hearted state's glyph. Lucide is a FONT here, so `Icon(fill: 1)` is a
/// no-op on it — this widget exists to draw the fill as an SVG path instead,
/// and what it must guarantee is the size and colour the row asks for.
void main() {
  SvgPicture svgOf(WidgetTester tester) =>
      tester.widget<SvgPicture>(find.byType(SvgPicture));

  testWidgets('draws the tertiary 18pt glyph in danger by default', (
    tester,
  ) async {
    await tester.pumpWidget(const FilledHeart());

    final svg = svgOf(tester);
    expect(svg.width, 18);
    expect(svg.height, 18);
    expect(
      svg.colorFilter,
      const ColorFilter.mode(KalloColors.danger, BlendMode.srcIn),
    );
  });

  testWidgets('honours a caller size and colour', (tester) async {
    await tester.pumpWidget(
      const FilledHeart(size: 32, color: Color(0xFF00FF00)),
    );

    final svg = svgOf(tester);
    expect(svg.width, 32);
    expect(svg.height, 32);
    expect(
      svg.colorFilter,
      const ColorFilter.mode(Color(0xFF00FF00), BlendMode.srcIn),
    );
  });
}
