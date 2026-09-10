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

  testWidgets('the warm decodes ONCE, into the entry the widget then reuses', (
    tester,
  ) async {
    // The Circle feed warms this glyph at page load so the first heart tap
    // is a repaint rather than an SVG parse on the UI thread. That only buys
    // anything if the warmed entry is the one the widget looks up — same
    // source string, same (absent) theme — so the count must not grow when
    // the widget mounts.
    svg.cache.clear();
    precacheFilledHeart();
    Future<void> decode() => tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 400)),
    );
    await decode();
    expect(svg.cache.count, 1, reason: 'the warm decoded into the cache');

    await tester.pumpWidget(const FilledHeart(size: 20));
    await decode();
    await tester.pumpAndSettle();
    expect(svg.cache.count, 1, reason: 'the widget hit the warmed entry');
  });
}
