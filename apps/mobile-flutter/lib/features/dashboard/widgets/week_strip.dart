/// WeekStrip — the dashboard's always-on 7-day week strip.
///
/// Centered on today (3 days before / 3 after). Each day shows its weekday
/// abbreviation and date number inside a small **calorie ring** — the accent
/// arc fills with that day's progress toward the target (`consumedRatio` =
/// calories ÷ target, ungated). Today fills live as meals are logged (the
/// bundle refetches on confirm); days with no log show an empty track ring;
/// future days are bare + dimmed. Read-only — the per-day data comes off the
/// heatmap slice already in the dashboard bundle, so there's no extra fetch.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/dashboard.dart';
import '../../../theme/kallo_colors.dart';
import '../../logging/logic/timeline_utils.dart';
import '../data/dashboard_providers.dart';
import '../logic/dashboard_spacing.dart';
import '../../../theme/calm_tokens.dart';

class WeekStrip extends ConsumerWidget {
  const WeekStrip({
    super.key,
    required this.args,
    required this.todayDate,
    required this.selectedDate,
    required this.onSelectDay,
  });

  /// Today-anchored args — the heatmap/ring data stays "as of today" even when
  /// another day is selected.
  final DashboardArgs args;
  final String todayDate;

  /// The day whose summary the Today card is showing (the white chip).
  final String selectedDate;
  final ValueChanged<String> onSelectDay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Per-day adherence (ratio + status) keyed by date, off the heatmap slice.
    final heatmap = ref.watch(heatmapProvider(args)).valueOrNull;
    final byDate = <String, HeatmapCell>{};
    if (heatmap != null) {
      for (final row in heatmap.cells) {
        for (final cell in row) {
          byDate[cell.date] = cell;
        }
      }
    }

    final days = buildCenteredStripFromAnchor(todayDate).days;
    final locale = context.locale.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: DashboardSpacing.block),
      child: Row(
        children: [
          for (final d in days)
            Expanded(
              child: _DayCell(
                date: d,
                isToday: d == todayDate,
                isSelected: d == selectedDate,
                cell: byDate[d],
                locale: locale,
                onSelectDay: onSelectDay,
              ),
            ),
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.isToday,
    required this.isSelected,
    required this.cell,
    required this.locale,
    required this.onSelectDay,
  });

  final String date;
  final bool isToday;
  final bool isSelected;
  final HeatmapCell? cell;
  final String locale;
  final ValueChanged<String> onSelectDay;

  static const double _ring = 36;

  @override
  Widget build(BuildContext context) {
    final dt = dateStringToDate(date);
    final weekday = DateFormat('EEE', locale).format(dt); // locale-aware, e.g. "Sun"
    final labelColor = isToday ? kInk : kInkMuted;

    final consumed = cell?.consumedRatio;
    final isFuture = cell?.status == HeatmapCellStatus.future ||
        cell?.status == HeatmapCellStatus.outside;

    // Progress ring: the accent arc fills as the day's calories approach the
    // target (consumed ÷ target, clamped to a full sweep when over). Days with
    // no logged calories show only the track.
    final arcColor =
        (consumed != null && consumed > 0) ? KalloColors.accent : null;
    final fraction =
        consumed != null ? consumed.clamp(0.0, 1.0).toDouble() : 0.0;

    final cell0 = Container(
      // Equal margin/padding on every cell keeps the weekday letters aligned;
      // only the SELECTED day gets the solid white chip + soft lift.
      margin: const EdgeInsets.symmetric(horizontal: 3),
      // The chip's own inset — one row's padding on each side of the cell.
      padding: const EdgeInsets.symmetric(vertical: DashboardSpacing.row * 2),
      decoration: isSelected
          ? BoxDecoration(
              color: kCardSurface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14141413), // ink @8% — small-chip lift
                  blurRadius: 12,
                  offset: Offset(0, 4),
                ),
              ],
            )
          : null,
      child: Column(
        children: [
          Text(
            weekday,
            maxLines: 1,
            // Meta 12 like every other caption on the surface (mixed-case,
            // locale-safe); medium weight is what marks today, not size.
            style: dashMeta(color: labelColor)
                .copyWith(fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: DashboardSpacing.row),
          SizedBox(
            width: _ring,
            height: _ring,
            child: CustomPaint(
              painter: _DayRingPainter(
                fraction: fraction,
                arcColor: arcColor,
                // In-range days (even unlogged) get a faint track; future bare.
                showTrack: !isFuture,
              ),
              child: Center(
                child: Text(
                  '${dt.day}',
                  style: dashBody(
                    color: isFuture ? kInkMuted : kInk,
                    weight: isToday ? FontWeight.w600 : FontWeight.w400,
                    tabular: true,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    // Future days have no day to browse → not selectable.
    if (isFuture) return cell0;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        HapticFeedback.selectionClick();
        onSelectDay(date);
      },
      child: cell0,
    );
  }
}

/// A small progress ring: a faint track + a rounded arc swept clockwise from 12
/// o'clock for [fraction] of the circle, in the heatmap tier [arcColor].
class _DayRingPainter extends CustomPainter {
  _DayRingPainter({
    required this.fraction,
    required this.arcColor,
    required this.showTrack,
  });

  final double fraction;
  final Color? arcColor;
  final bool showTrack;

  static const double _stroke = 2.5;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - _stroke) / 2;

    if (showTrack) {
      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = _stroke
          ..color = KalloColors.track, // same grey track as the calorie ring,
        // so the accent progress arc reads clearly
      );
    }

    if (arcColor != null && fraction > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2, // 12 o'clock
        2 * math.pi * fraction,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = _stroke
          ..strokeCap = StrokeCap.round
          ..color = arcColor!,
      );
    }
  }

  @override
  bool shouldRepaint(_DayRingPainter old) =>
      old.fraction != fraction ||
      old.arcColor != arcColor ||
      old.showTrack != showTrack;
}
