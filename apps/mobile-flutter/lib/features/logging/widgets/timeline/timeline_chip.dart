import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
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
  /// Visual pill height; the tap target around it is [KalloIcons.hit] (44).
  static const double _visual = 36;

  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final hasMeal = widget.dates.contains(widget.selectedDate);
    final formatted = formatTimelineDayLabel(widget.selectedDate, locale);

    // 36pt visual on a 44pt tap target — the app-wide chip metric.
    //
    // The FILL is the app's selected-chip treatment ([kTrack], no border), not
    // the unselected one (white + hairline). This chip is not a choice among
    // siblings: it always names the day currently being read, so it is
    // permanently in the selected state, and the Circle filter pill it matches
    // draws exactly this when chosen.
    //
    // It was white-with-no-border after the native pass, which is neither half
    // of that language — a white chip needs the hairline to separate from the
    // canvas (the dashboard's week-strip cell says so in as many words), and
    // white-on-canvas lost what little separation it had when the canvas
    // lightened. On [kTrack] the chip has a real edge without a line, and the
    // recessed neutral reads as "this is the day you are on".
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: SizedBox(
        height: KalloIcons.hit,
        child: Center(
          child: AnimatedScale(
            scale: _pressed ? 0.96 : 1,
            duration: KalloMotion.press,
            curve: KalloEase.press,
            child: Container(
              height: _visual,
              constraints: const BoxConstraints(maxWidth: 288), // max-w-72
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp4, // 16 — the house chip inset
              ),
              decoration: BoxDecoration(
                color: kTrack,
                // The token, not the literal 18 it happened to equal at this
                // height: a chip is a pill at whatever height it ends up.
                borderRadius: BorderRadius.circular(KalloRadii.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Ink, not muted: inside a chip the glyph reads with the
                  // label rather than as a caption beside it. Tertiary tier
                  // (18) — the app's pairing for a glyph sitting beside Body.
                  const Icon(
                    LucideIcons.calendar300,
                    size: KalloIcons.tertiary,
                    color: kInk,
                  ),
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
