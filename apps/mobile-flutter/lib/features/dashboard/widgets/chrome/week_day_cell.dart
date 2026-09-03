/// One day of the dashboard's week strip: weekday letters over a small calorie
/// ring with the date number inside it.
///
/// Split out of `week_strip.dart` when the strip became a horizontal pager —
/// the strip owns paging, the cell owns one day's presentation.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/profile/dashboard.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../logging/logic/timeline_utils.dart';
import '../../logic/dashboard_spacing.dart';

class WeekDayCell extends StatelessWidget {
  const WeekDayCell({
    super.key,
    required this.date,
    required this.isToday,
    required this.isSelected,
    required this.isAfterToday,
    required this.cell,
    required this.locale,
    required this.onSelectDay,
  });

  final String date;
  final bool isToday;
  final bool isSelected;

  /// Calendar truth, independent of the heatmap: a day past today is never
  /// selectable even when the 90-day heatmap has no cell for it at all.
  final bool isAfterToday;

  /// This day's heatmap slice, or null when the day is older than the 90-day
  /// heatmap window (browsable, but drawn with the track only).
  final HeatmapCell? cell;
  final String locale;
  final ValueChanged<String> onSelectDay;

  static const double ring = 36;

  /// The cell's laid-out height, derived from the tokens it uses: the chip's
  /// vertical inset, one meta line, the label gap and the ring. The strip's
  /// PageView needs a bounded height and must not measure its pages.
  /// = 8 + 8 (chip inset) + 18 (one 14/1.25 meta line, rounded up so a
  /// fractional line box cannot overflow the row) + 4 (label gap) + 36 (ring)
  /// + 2 for the selected chip's hairline, which deflates its own content box
  /// top and bottom — miss it and the ONE selected cell overflows by exactly 2.
  static const double height =
      DashboardSpacing.row * 4 + 18 + DashboardSpacing.row + ring + 2;

  @override
  Widget build(BuildContext context) {
    final dt = dateStringToDate(date);
    final weekday = DateFormat('EEE', locale).format(dt); // locale-aware, e.g. "Sun"
    final labelColor = isToday ? kInk : kInkMuted;

    final consumed = cell?.consumedRatio;
    final isFuture = isAfterToday ||
        cell?.status == HeatmapCellStatus.future ||
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
      // only the SELECTED day gets the white chip.
      margin: const EdgeInsets.symmetric(horizontal: 3),
      // The chip's own inset — one row's padding on each side of the cell.
      padding: const EdgeInsets.symmetric(vertical: DashboardSpacing.row * 2),
      decoration: isSelected
          // A chip this small is the one card-like surface that still takes a
          // hairline: at 36pt across, white-on-#F8F7F4 alone does not read as
          // a selected state. Shadow retired with the rest of the cards.
          ? BoxDecoration(
              color: kCardSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kHairline),
            )
          : null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            weekday,
            maxLines: 1,
            // Meta like every other caption on the surface (mixed-case,
            // locale-safe); colour is what marks today, not weight or size.
            style: dashMeta(color: labelColor),
          ),
          const SizedBox(height: DashboardSpacing.row),
          SizedBox(
            width: ring,
            height: ring,
            child: CustomPaint(
              painter: WeekDayRingPainter(
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
class WeekDayRingPainter extends CustomPainter {
  WeekDayRingPainter({
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
  bool shouldRepaint(WeekDayRingPainter old) =>
      old.fraction != fraction ||
      old.arcColor != arcColor ||
      old.showTrack != showTrack;
}
