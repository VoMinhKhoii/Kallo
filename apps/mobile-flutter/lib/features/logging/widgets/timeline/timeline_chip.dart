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

    // 36pt visual on a 44pt tap target — the app-wide chip metric. The chip is
    // white on the canvas, so it needs no border to separate.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: SizedBox(
        height: 44,
        child: Center(
          child: AnimatedScale(
            scale: _pressed ? 0.96 : 1,
            duration: KalloMotion.press,
            curve: KalloEase.press,
            child: Container(
              height: 36,
              constraints: const BoxConstraints(maxWidth: 288), // max-w-72
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp3_5, // 14
              ),
              decoration: BoxDecoration(
                color: KalloColors.elev,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Ink, not muted: inside a chip the glyph reads with the
                  // label rather than as a caption beside it.
                  const Icon(LucideIcons.calendar300, size: 18, color: kInk),
                  const SizedBox(width: KalloSpacing.sp2), // gap-2
                  Flexible(
                    child: Text(
                      formatted,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashBody(weight: FontWeight.w500),
                    ),
                  ),
                  // "This day has meals on it" — ink, like every other mark in
                  // the chip. Tan is reserved for non-text moments elsewhere,
                  // but here it was the only coloured thing in the header.
                  if (hasMeal) ...[
                    const SizedBox(width: KalloSpacing.sp2),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: kInk,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
