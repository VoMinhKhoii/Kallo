import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/gauge/day_ring_painter.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/days/log_calendar.dart';

/// One day of the month calendar: a 46pt target holding the date inside its
/// calorie ring. The web calendar's day (`calendar-day-button.tsx`) in iOS
/// tokens: the ring is ink while the day is short and green once it reaches
/// the completeness floor, a day with no known total keeps the bare track, a
/// future day has no ring and no tap, today is semibold, and the selected
/// day is semibold on the beige wash.
class LogCalendarDay extends StatelessWidget {
  const LogCalendarDay({
    super.key,
    required this.day,
    required this.measure,
    required this.isToday,
    required this.isSelected,
    required this.isFuture,
    required this.semanticsLabel,
    required this.onTap,
  });

  final int day;
  final DayMeasure? measure;
  final bool isToday;
  final bool isSelected;
  final bool isFuture;
  final String semanticsLabel;
  final VoidCallback onTap;

  static const double size = 46;
  static const double ring = 36;

  @override
  Widget build(BuildContext context) {
    final m = measure;
    // A zero-kcal day has nothing to sweep: it reads as a bare track.
    final arc = m != null && m.fraction > 0 ? m : null;
    final cell = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isSelected ? KalloColors.hover : null,
        borderRadius: BorderRadius.circular(14),
      ),
      alignment: Alignment.center,
      child: SizedBox(
        width: ring,
        height: ring,
        child: CustomPaint(
          painter:
              isFuture
                  ? null
                  : DayRingPainter(
                    fraction: (arc?.fraction ?? 0).clamp(0.0, 1.0),
                    arcColor:
                        arc == null
                            ? null
                            : arc.met
                            ? KalloColors.successAccent
                            : KalloColors.text,
                    showTrack: true,
                  ),
          child: Center(
            child: Text(
              '$day',
              style: dashBody(
                color: isFuture ? KalloColors.stone50 : null,
                weight:
                    isToday || isSelected ? FontWeight.w600 : FontWeight.w400,
                tabular: true,
              ),
            ),
          ),
        ),
      ),
    );
    if (isFuture) {
      return Semantics(
        label: semanticsLabel,
        child: ExcludeSemantics(child: cell),
      );
    }
    return Semantics(
      button: true,
      selected: isSelected,
      label: semanticsLabel,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: cell,
      ),
    );
  }
}
