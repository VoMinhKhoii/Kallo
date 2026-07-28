import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/dashboard/logic/heatmap_month_labels.dart';
import 'package:nham_mobile/features/dashboard/logic/weight_chart_axis.dart';
import 'package:nham_mobile/models/dashboard.dart';

const _style = TextStyle(fontSize: 10);

void main() {
  group('niceYAxis', () {
    // The newest point is drawn with a 9px halo inside a clipped plot, so it
    // must never sit on maxY (or minY).
    void expectHeadroom(List<double> values) {
      final axis = niceYAxis(values);
      final min = values.reduce((a, b) => a < b ? a : b);
      final max = values.reduce((a, b) => a > b ? a : b);
      expect(axis.min, lessThan(min), reason: 'no headroom below $values');
      expect(axis.max, greaterThan(max), reason: 'no headroom above $values');
      expect(axis.max - axis.min, greaterThanOrEqualTo(axis.step * 3 - 1e-9));
      // Bounds stay on whole steps so the gridlines and gutter labels stay
      // round.
      expect((axis.min / axis.step) % 1, closeTo(0, 1e-9));
      expect((axis.max / axis.step) % 1, closeTo(0, 1e-9));
    }

    test('single point', () => expectHeadroom([70.0]));
    test('flat series', () => expectHeadroom([70.0, 70.0, 70.0]));
    test('two points', () => expectHeadroom([68.0, 70.0]));
    test('2 kg spread', () => expectHeadroom([68.0, 69.4, 68.6, 70.0]));
    test('steeply falling', () => expectHeadroom([75.0, 73.0, 71.0, 67.0]));
    test('wide spread', () => expectHeadroom([60.0, 90.0]));

    test('a 2 kg spread sits roughly mid-band', () {
      final axis = niceYAxis([68.0, 70.0]);
      expect(axis.min, 67.0);
      expect(axis.max, 71.0);
      expect(axis.step, 1.0);
    });
  });

  group('layoutMonthLabels', () {
    List<MonthLabelBox> layout(List<HeatmapMonthHeader> headers) =>
        layoutMonthLabels(
          headers: headers,
          cellSize: 12,
          gap: 2,
          gridWidth: 14 * 12 + 13 * 2,
          style: _style,
          textScaler: TextScaler.noScaling,
        );

    test('drops a sliver month that shares a column with the next', () {
      // Apr covers 1–2 days of the very first week column; May starts in the
      // same column. Both used to paint at left: 0.
      final boxes = layout(const [
        HeatmapMonthHeader(month: 'Apr', startColumn: 0, span: 1),
        HeatmapMonthHeader(month: 'May', startColumn: 0, span: 5),
      ]);
      expect(boxes.map((b) => b.month), ['May']);
      expect(boxes.single.left, 0);
    });

    test('never paints two labels over one another', () {
      final boxes = layout(const [
        HeatmapMonthHeader(month: 'Apr', startColumn: 0, span: 3),
        HeatmapMonthHeader(month: 'May', startColumn: 2, span: 5),
        HeatmapMonthHeader(month: 'Jun', startColumn: 6, span: 5),
        HeatmapMonthHeader(month: 'Jul', startColumn: 10, span: 4),
      ]);
      expect(boxes.length, greaterThan(1));
      for (var i = 1; i < boxes.length; i++) {
        expect(
          boxes[i].left,
          greaterThanOrEqualTo(boxes[i - 1].left + boxes[i - 1].width),
        );
      }
      for (final box in boxes) {
        expect(box.left + box.width, lessThanOrEqualTo(14 * 12 + 13 * 2 + 1));
      }
    });
  });
}
