/// WeekStrip — the Mon→Sun strip at the top of the dashboard.
///
/// Shows the whole week (the card below is just today), with today highlighted
/// and a small dot under any day that has a logged meal. The logged-day signal
/// is read off the heatmap slice already in the dashboard bundle — no extra
/// fetch.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/dashboard.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import '../logic/dashboard_format.dart';
import 'dashboard_tokens.dart';

class WeekStrip extends ConsumerWidget {
  const WeekStrip({super.key, required this.args, required this.todayDate});

  final DashboardArgs args;
  final String todayDate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = weekDaysFor(todayDate);

    // Dates with a logged (or partial) meal, off the heatmap bundle slice.
    final heatmap = ref.watch(heatmapProvider(args)).valueOrNull;
    final logged = <String>{};
    if (heatmap != null) {
      for (final row in heatmap.cells) {
        for (final cell in row) {
          if (cell.status == HeatmapCellStatus.logged ||
              cell.status == HeatmapCellStatus.partial) {
            logged.add(cell.date);
          }
        }
      }
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
      child: Row(
        children: [
          for (final d in days)
            Expanded(
              child: _Day(
                date: d,
                isToday: dateString(d) == todayDate,
                logged: logged.contains(dateString(d)),
              ),
            ),
        ],
      ),
    );
  }

  // Local YYYY-MM-DD for a DateTime (reuses todayDateString's formatting).
  static String dateString(DateTime d) => todayDateString(d);
}

const List<String> _letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

class _Day extends StatelessWidget {
  const _Day({required this.date, required this.isToday, required this.logged});

  final DateTime date;
  final bool isToday;
  final bool logged;

  @override
  Widget build(BuildContext context) {
    final letter = _letters[(date.weekday - 1) % 7];
    return Column(
      children: [
        Text(
          letter,
          style: dashEyebrow(
              color: isToday ? NhamColors.accentDark : kInkSecondary),
        ),
        const SizedBox(height: 6),
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: isToday
              ? BoxDecoration(
                  color: NhamColors.accent10,
                  shape: BoxShape.circle,
                  border: Border.all(color: NhamColors.accent),
                )
              : null,
          child: Text(
            '${date.day}',
            style: dashBody(
              color: kInk,
              weight: isToday ? FontWeight.w600 : FontWeight.w400,
              tabular: true,
            ),
          ),
        ),
        const SizedBox(height: 5),
        // Logged-day dot (fixed footprint so rows stay aligned).
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(
            color: logged ? NhamColors.accent : Colors.transparent,
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}
