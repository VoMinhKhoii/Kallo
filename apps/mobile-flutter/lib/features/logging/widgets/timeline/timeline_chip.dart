import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/timeline_utils.dart';

/// The collapsed date pill that lives in the app header. Tapping it asks the
/// parent to open the [TimelineStrip] as a dropdown overlay — the chip itself
/// never changes size, so the feed below never shifts.
class TimelineChip extends StatefulWidget {
  const TimelineChip({
    super.key,
    required this.dates,
    required this.selectedDate,
    required this.onTap,
  });

  final List<String> dates;
  final String selectedDate;
  final VoidCallback onTap;

  @override
  State<TimelineChip> createState() => _TimelineChipState();
}

class _TimelineChipState extends State<TimelineChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final hasMeal = widget.dates.contains(widget.selectedDate);
    final formatted = formatTimelineDayLabel(widget.selectedDate, locale);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: KalloMotion.press,
        curve: KalloEase.press,
        child: Container(
          height: 44,
          constraints: const BoxConstraints(maxWidth: 288), // max-w-72
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
          decoration: BoxDecoration(
            color: KalloColors.surface,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
            border: Border.all(color: KalloColors.borderHalf), // border/50
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.calendar300,
                  size: 14, color: KalloColors.textMuted),
              const SizedBox(width: KalloSpacing.sp2), // gap-2
              Flexible(
                child: Text(
                  formatted,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashMeta().merge(const TextStyle(color: kInk)),
                ),
              ),
              if (hasMeal) ...[
                const SizedBox(width: KalloSpacing.sp2),
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: KalloColors.accent,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
