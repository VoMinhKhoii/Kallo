import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/logic/time_of_day.dart';

/// The bucket boundaries are shared by the composer's serif prompt and the
/// surface-state cast's sleeping pose, so they are pinned hour by hour —
/// including every edge — against the web `lib/domain/logging/empty-prompt.ts`
/// table they are ported from.
void main() {
  group('bucketForHour', () {
    const table = <int, TimeOfDayBucket>{
      4: TimeOfDayBucket.lateNight,
      5: TimeOfDayBucket.morning,
      10: TimeOfDayBucket.morning,
      11: TimeOfDayBucket.lunch,
      14: TimeOfDayBucket.lunch,
      15: TimeOfDayBucket.afternoon,
      17: TimeOfDayBucket.afternoon,
      18: TimeOfDayBucket.evening,
      21: TimeOfDayBucket.evening,
      22: TimeOfDayBucket.lateNight,
      23: TimeOfDayBucket.lateNight,
      0: TimeOfDayBucket.lateNight,
    };

    table.forEach((hour, bucket) {
      test('$hour:00 is ${bucket.name}', () {
        expect(bucketForHour(hour), bucket);
      });
    });
  });

  group('isLateNight', () {
    test('is true from 22:00 through 04:59 and false the rest of the day', () {
      for (var hour = 0; hour < 24; hour++) {
        expect(isLateNight(hour), hour >= 22 || hour < 5, reason: 'hour $hour');
      }
    });
  });
}
