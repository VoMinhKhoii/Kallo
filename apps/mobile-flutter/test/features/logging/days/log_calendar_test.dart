import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/days/log_calendar.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';

HeatmapCell _cell(String date, HeatmapCellStatus status) =>
    HeatmapCell(date: date, ratio: null, consumedRatio: null, status: status);

void main() {
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

  group('weeks', () {
    test('a week starts on its Monday', () {
      // 2026-11-28 is a Saturday.
      expect(weekOf('2026-11-28'), DateTime(2026, 11, 23));
      expect(weekOf('2026-11-23'), DateTime(2026, 11, 23));
      expect(weekOf('2026-11-29'), DateTime(2026, 11, 23));
    });

    test('seven days, Monday first, across a month and a year', () {
      expect(weekDates(DateTime(2026, 11, 30)), [
        '2026-11-30',
        '2026-12-01',
        '2026-12-02',
        '2026-12-03',
        '2026-12-04',
        '2026-12-05',
        '2026-12-06',
      ]);
      expect(weekDates(weekOf('2027-01-01')).first, '2026-12-28');
      expect(shiftWeek(DateTime(2027, 1, 4), -1), DateTime(2026, 12, 28));
    });

    test('next is offered only before this week', () {
      expect(canShowNextWeek(DateTime(2026, 11, 23), '2026-11-28'), isFalse);
      expect(canShowNextWeek(DateTime(2026, 11, 16), '2026-11-28'), isTrue);
    });

    test('previous needs the whole week before to be covered', () {
      final days = [
        _cell('2026-11-28', HeatmapCellStatus.unlogged),
        _cell('2026-11-17', HeatmapCellStatus.unlogged),
      ];
      // Covered back to Tue Nov 17: the week of Nov 16 is only reached into.
      expect(canShowPreviousWeek(DateTime(2026, 11, 23), days), isFalse);
      // The week of Nov 23 is covered whole, so the one after pages to it.
      expect(canShowPreviousWeek(DateTime(2026, 11, 30), days), isTrue);
      final whole = [...days, _cell('2026-11-16', HeatmapCellStatus.unlogged)];
      expect(canShowPreviousWeek(DateTime(2026, 11, 23), whole), isTrue);
      expect(canShowPreviousWeek(DateTime(2026, 11, 23), null), isFalse);
      expect(canShowPreviousWeek(DateTime(2026, 11, 23), const []), isFalse);
    });
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
