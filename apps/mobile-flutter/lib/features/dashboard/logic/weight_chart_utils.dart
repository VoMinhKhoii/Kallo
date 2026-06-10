/// Vendored VERBATIM from the RN `lib/dashboard/logic/weight-chart-utils.ts` —
/// keep in sync.
///
/// Provides the X-axis ticks + a label formatter: W1/W2/…/Now for 30d,
/// month-short/Now for 90d.
library;

import 'package:intl/intl.dart';

import '../../../models/dashboard.dart';

/// Result of [buildXTicks]: the tick indices plus a label formatter that takes
/// `(value, idx)` and returns the displayed string.
class XTicks {
  const XTicks(this.ticks, this.formatter);

  final List<int> ticks;
  final String Function(int value, int idx) formatter;
}

List<int> _uniqueTicks(List<int> values) {
  final seen = <int>{};
  final out = <int>[];
  for (final v in values) {
    if (seen.add(v)) out.add(v);
  }
  return out;
}

/// Builds X-axis ticks + formatter for the weight chart. [count] is the number
/// of data points; [range] selects the labeling strategy.
XTicks buildXTicks(
  int count,
  WeightRange range,
  String locale,
  String nowLabel,
  String weekPrefix,
) {
  if (count < 2) {
    return XTicks([0], (_, __) => nowLabel);
  }

  if (range == WeightRange.d30) {
    final step = count ~/ 4;
    final ticks = _uniqueTicks([0, step, step * 2, step * 3, count - 1]);
    return XTicks(
      ticks,
      (_, idx) => idx == ticks.length - 1 ? nowLabel : '$weekPrefix${idx + 1}',
    );
  }

  // 90d — show months.
  final today = DateTime.now();
  final monthFormatter = DateFormat.MMM(locale);
  final ticks = <int>[];
  final labels = <String>[];
  for (var i = 2; i > 0; i--) {
    final d = DateTime(today.year, today.month - i, today.day);
    final dayIndex = count - 1 - i * 30;
    ticks.add(dayIndex < 0 ? 0 : dayIndex);
    labels.add(monthFormatter.format(d));
  }
  ticks.add(count - 1);
  labels.add(nowLabel);
  return XTicks(
    _uniqueTicks(ticks),
    (_, idx) => idx < labels.length ? labels[idx] : '',
  );
}
