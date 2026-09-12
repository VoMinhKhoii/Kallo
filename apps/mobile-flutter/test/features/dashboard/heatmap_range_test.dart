import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/dashboard/logic/heatmap_range.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';

/// Content width the card gives the grid at a given device width: screen less
/// the 12pt screen padding, the 16pt card padding, the day-label gutter and its
/// 4pt spacer — the same arithmetic `AdherenceHeatmap` does.
double _content(double screenWidth) => screenWidth - 12 * 2 - 16 * 2 - 21 - 4;

void main() {
  HeatmapRange choose(double screenWidth) => chooseRenderedHeatmapRange(
    preferredRange: HeatmapRange.year,
    availableWidth: _content(screenWidth),
  );

  group('chooseRenderedHeatmapRange', () {
    test('every phone width stays on the 90-day window', () {
      // 320 (SE) through 440 (16 Pro Max). A year at 53 columns cannot reach
      // its 10px floor on any of them, so phone rendering is untouched.
      for (final width in [320.0, 360.0, 375.0, 390.0, 402.0, 430.0, 440.0]) {
        expect(choose(width), HeatmapRange.d90, reason: '$width pt');
      }
    });

    test('tablet widths buy history instead of bigger cells', () {
      for (final width in [744.0, 834.0, 1024.0, 1366.0]) {
        expect(choose(width), HeatmapRange.year, reason: '$width pt');
      }
    });

    test('falls back to 30d when even 90d cannot read', () {
      expect(
        chooseRenderedHeatmapRange(
          preferredRange: HeatmapRange.year,
          availableWidth: 120,
        ),
        HeatmapRange.d30,
      );
    });

    test('a 30d preference is never widened', () {
      expect(
        chooseRenderedHeatmapRange(
          preferredRange: HeatmapRange.d30,
          availableWidth: 4000,
        ),
        HeatmapRange.d30,
      );
    });

    test('the ceiling keeps a tablet cell from inflating', () {
      // 90d at iPad width would be ~51px without a cap; the cap is what makes
      // the wider range the better answer rather than a taller card.
      expect(heatmapMaxCell[HeatmapRange.d90], lessThan(51));
    });
  });
}
