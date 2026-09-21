import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart_series.dart';

const _spots = [FlSpot(0, 72.4), FlSpot(11, 71.5), FlSpot(22, 70.4)];
const _forecast = [FlSpot(22, 70.4), FlSpot(27.5, 69.8)];

WeightSeries _series({List<FlSpot>? forecast}) =>
    buildWeightSeries(spots: _spots, forecast: forecast, kg: 'kg');

List<LineTooltipItem?> _tooltip(
  WeightSeries series,
  int barIndex,
  FlSpot spot,
) => series.touch.touchTooltipData.getTooltipItems([
  LineBarSpot(series.bars[barIndex], barIndex, spot),
]);

void main() {
  group('tooltips', () {
    test('a logged reading shows its weight', () {
      final series = _series(forecast: _forecast);
      // The forecast is drawn first, so the logged bar is the second one.
      final items = _tooltip(series, 1, _spots.last);

      expect(items.single?.text, '70.4 kg');
    });

    // The projection is not a reading. This used to be decided by bar index,
    // which means different things depending on whether a forecast exists.
    test('the projection tail shows nothing', () {
      final series = _series(forecast: _forecast);
      expect(_tooltip(series, 0, _forecast.last).single, isNull);
    });

    test('the logged bar still shows its weight when there is no forecast', () {
      final series = _series();
      expect(series.bars, hasLength(1));
      expect(_tooltip(series, 0, _spots.last).single?.text, '70.4 kg');
    });
  });

  group('bars', () {
    test(
      'the logged line uses straight segments, the forecast a dashed tail',
      () {
        final series = _series(forecast: _forecast);
        final forecastBar = series.bars.first;
        final loggedBar = series.bars.last;

        expect(forecastBar.dashArray, isNotNull);
        expect(forecastBar.dotData.show, isFalse);

        expect(loggedBar.isCurved, isFalse);
        expect(loggedBar.isStrokeCapRound, isTrue);
        expect(loggedBar.isStrokeJoinRound, isTrue);
        expect(loggedBar.barWidth, 3);
        expect(loggedBar.dashArray, isNull);
      },
    );

    test('nothing logged means nothing to draw or touch', () {
      final series = buildWeightSeries(
        spots: const [],
        forecast: null,
        kg: 'kg',
      );

      expect(series.bars, isEmpty);
      expect(series.touch.enabled, isFalse);
    });
  });
}
