/// Pure presentation-time helpers for Circle thread entries and day dividers.
library;

import 'package:intl/intl.dart';

enum ThreadDayLabelKind { today, yesterday, date }

class ThreadDayLabel {
  const ThreadDayLabel._(this.kind, this.dateLabel);

  const ThreadDayLabel.today() : this._(ThreadDayLabelKind.today, null);
  const ThreadDayLabel.yesterday() : this._(ThreadDayLabelKind.yesterday, null);
  const ThreadDayLabel.date(String label)
    : this._(ThreadDayLabelKind.date, label);

  final ThreadDayLabelKind kind;

  /// Present only for [ThreadDayLabelKind.date]. Today/yesterday are localized
  /// by the UI using their existing message keys.
  final String? dateLabel;
}

String formatElapsed(DateTime value, {DateTime? now, required String locale}) {
  final elapsed = (now ?? DateTime.now()).difference(value);
  final minutes = (elapsed.inMilliseconds / Duration.millisecondsPerMinute)
      .round()
      .clamp(1, 1 << 31);

  late final int amount;
  late final String englishUnit;
  late final String vietnameseUnit;
  if (minutes < 60) {
    amount = minutes;
    englishUnit = 'm';
    vietnameseUnit = 'phút';
  } else {
    final hours = (minutes / 60).round();
    if (hours < 24) {
      amount = hours;
      englishUnit = 'h';
      vietnameseUnit = 'giờ';
    } else {
      amount = (hours / 24).round();
      englishUnit = 'd';
      vietnameseUnit = 'ngày';
    }
  }

  if (locale.toLowerCase().startsWith('vi')) {
    return '$amount $vietnameseUnit trước';
  }
  return '$amount$englishUnit ago';
}

/// The clock time a meal was logged, in the VIEWER's zone.
///
/// The feed is already grouped by day, so an elapsed span next to the author
/// repeated a fact the separator above had just stated — and buried the one it
/// had not: what time of day the meal was eaten.
///
/// This reads [CircleFeedMeal.sharedAt] rather than the server's `loggedAt`,
/// which is not exported to the client and would be the wrong field anyway:
/// `loggedAt` carries the chosen local DATE stamped with the time-of-day the
/// meal was ANALYZED, so for a backfill its clock time is meaningless. sharedAt
/// is set within minutes of analysis for a real-time log, and the one case
/// where the two diverge — a backfilled share — already hides the timestamp
/// altogether.
String formatLoggedTime(DateTime value, {required String locale}) =>
    DateFormat.jm(locale).format(value.toLocal());

/// Viewer-local calendar-day identity used to group adjacent feed entries.
String threadDayKey(DateTime value) {
  final local = value.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}

/// Returns a localizable today/yesterday token or an already locale-formatted
/// older date. It deliberately has no BuildContext dependency.
ThreadDayLabel threadDayLabel(
  DateTime value, {
  DateTime? now,
  required String locale,
}) {
  final current = (now ?? DateTime.now()).toLocal();
  final localValue = value.toLocal();
  if (threadDayKey(localValue) == threadDayKey(current)) {
    return const ThreadDayLabel.today();
  }

  final yesterday = DateTime(current.year, current.month, current.day - 1);
  if (threadDayKey(localValue) == threadDayKey(yesterday)) {
    return const ThreadDayLabel.yesterday();
  }

  final formatter =
      localValue.year == current.year
          ? DateFormat.MMMMd(locale)
          : DateFormat.yMMMMd(locale);
  return ThreadDayLabel.date(formatter.format(localValue));
}
