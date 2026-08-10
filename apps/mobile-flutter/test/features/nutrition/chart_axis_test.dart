import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'package:nham_mobile/features/nutrition/logic/format_date.dart';

/// `count` consecutive bucket start dates stepping `stepDays` from `start`.
List<String> _dates(String start, int count, int stepDays) {
  final first = DateTime.parse(start);
  return [
    for (var i = 0; i < count; i++)
      first.add(Duration(days: i * stepDays)).toIso8601String().substring(0, 10),
  ];
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
    await initializeDateFormatting('vi');
  });

  group('buildBucketTickLabels', () {
    test('labels every column on the 7-day axis', () {
      // 2026-05-04 is a Monday.
      final labels = buildBucketTickLabels(
        _dates('2026-05-04', 7, 1),
        'day',
        'en',
      );
      expect(labels, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    });

    test('anchors the 30-day axis weekly on the day number', () {
      final labels = buildBucketTickLabels(
        _dates('2026-05-04', 30, 1),
        'day',
        'en',
      );
      expect(labels.length, 30);
      expect(labels.where((l) => l.isNotEmpty).toList(),
          ['4', '11', '18', '25', '1']);
      expect(labels[1], '');
    });

    test('labels every column on a short week axis', () {
      final labels = buildBucketTickLabels(
        _dates('2026-05-04', 5, 7),
        'week',
        'en',
      );
      expect(labels, ['4/5', '11/5', '18/5', '25/5', '1/6']);
    });

    test('anchors the 90-day axis at month boundaries', () {
      // 13 weekly buckets from 2026-02-02 span February through April.
      final labels = buildBucketTickLabels(
        _dates('2026-02-02', 13, 7),
        'week',
        'en',
      );
      expect(labels.length, 13);
      expect(labels.where((l) => l.isNotEmpty).toList(), ['Feb', 'Mar', 'Apr']);
      expect(labels.first, 'Feb');
    });

    test('uses localized month names for the 90-day anchors', () {
      final labels = buildBucketTickLabels(
        _dates('2026-02-02', 13, 7),
        'week',
        'vi',
      );
      expect(
        labels.first,
        DateFormat.MMM('vi').format(DateTime.parse('2026-02-02')),
      );
    });

    test('keeps the Vietnamese weekday scheme on the short day axis', () {
      // 2026-05-03 is a Sunday → "CN"; 2026-05-04 is a Monday → "2".
      final labels = buildBucketTickLabels(
        _dates('2026-05-03', 2, 1),
        'day',
        'vi',
      );
      expect(labels, ['CN', '2']);
    });
  });
}
