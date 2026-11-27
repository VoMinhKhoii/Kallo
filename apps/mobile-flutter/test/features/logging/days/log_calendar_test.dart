import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/days/log_calendar.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';

HeatmapCell _cell(String date, HeatmapCellStatus status) =>
    HeatmapCell(date: date, ratio: null, consumedRatio: null, status: status);

void main() {
  group('monthCells', () {
    test('starts on Monday: November 2026 opens on a Sunday', () {
      final cells = monthCells(DateTime(2026, 11));
      expect(cells.take(6), everyElement(isNull));
      expect(cells[6], '2026-11-01');
      expect(cells.last, '2026-11-30');
      expect(cells.length, 6 + 30);
    });

    test('a month that opens on a Monday has no blanks', () {
      // June 2026 begins on a Monday.
      final cells = monthCells(DateTime(2026, 6));
      expect(cells.first, '2026-06-01');
      expect(cells.length, 30);
    });

    test('counts a leap February', () {
      expect(
        monthCells(DateTime(2028, 2)).whereType<String>().last,
        '2028-02-29',
      );
      expect(
        monthCells(DateTime(2026, 2)).whereType<String>().last,
        '2026-02-28',
      );
    });
  });

  group('paging', () {
    test('shiftMonth crosses the year both ways', () {
      expect(shiftMonth(DateTime(2026, 1), -1), DateTime(2025, 12));
      expect(shiftMonth(DateTime(2025, 12), 1), DateTime(2026, 1));
    });

    test('next is disabled on the current month only', () {
      expect(canShowNextMonth(DateTime(2026, 11), '2026-11-18'), isFalse);
      expect(canShowNextMonth(DateTime(2026, 10), '2026-11-18'), isTrue);
      expect(canShowNextMonth(DateTime(2025, 12), '2026-01-02'), isTrue);
    });

    test('previous needs the whole month before to be covered', () {
      // 90 days back from Nov 18 reach Aug 21.
      final days = [
        _cell('2026-11-18', HeatmapCellStatus.logged),
        _cell('2026-08-21', HeatmapCellStatus.unlogged),
      ];
      expect(canShowPreviousMonth(DateTime(2026, 11), days), isTrue);
      expect(canShowPreviousMonth(DateTime(2026, 10), days), isTrue);
      // August is covered from the 21st only: its first twenty days would
      // draw as empty when nobody knows what they hold.
      expect(canShowPreviousMonth(DateTime(2026, 9), days), isFalse);
      expect(canShowPreviousMonth(DateTime(2026, 8), days), isFalse);
    });

    test('previous is disabled until the data arrives', () {
      expect(canShowPreviousMonth(DateTime(2026, 11), null), isFalse);
      expect(canShowPreviousMonth(DateTime(2026, 11), const []), isFalse);
    });

    test(
      'a range that starts on the 1st still pages back from the next month',
      () {
        final days = [_cell('2026-10-01', HeatmapCellStatus.unlogged)];
        expect(canShowPreviousMonth(DateTime(2026, 11), days), isTrue);
        expect(canShowPreviousMonth(DateTime(2026, 10), days), isFalse);
        final dayLater = [_cell('2026-10-02', HeatmapCellStatus.unlogged)];
        expect(canShowPreviousMonth(DateTime(2026, 11), dayLater), isFalse);
      },
    );
  });

  test('pastDays drops padding cells and later days, newest first', () {
    final data = HeatmapData(
      cells: [
        [
          _cell('2026-11-16', HeatmapCellStatus.logged),
          _cell('2026-08-17', HeatmapCellStatus.outside),
        ],
        [
          _cell('2026-11-17', HeatmapCellStatus.unlogged),
          _cell('2026-11-19', HeatmapCellStatus.future),
        ],
      ],
      monthHeaders: const [],
    );
    expect(pastDays(data, '2026-11-18').map((c) => c.date), [
      '2026-11-17',
      '2026-11-16',
    ]);
  });

  group('measureDay', () {
    test('turns green at 85% of the target, as the web does', () {
      expect(measureDay(1700, 2000)!.met, isTrue);
      expect(measureDay(1699, 2000)!.met, isFalse);
      expect(measureDay(1000, 2000)!.fraction, .5);
    });

    test('runs past 1 over target', () {
      expect(measureDay(2400, 2000)!.fraction, 1.2);
    });

    test('measures nothing without a total or a target', () {
      expect(measureDay(null, 2000), isNull);
      expect(measureDay(1500, 0), isNull);
      expect(measureDay(1500, null), isNull);
    });
  });
}
