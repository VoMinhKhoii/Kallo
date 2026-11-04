import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/feed/day_actions.dart';
import '../../../logic/feed/view_state.dart';
import '../../../logic/logging_spacing.dart';

/// "I've eaten enough" on Today, under the dials (web: `today-close.tsx`).
///
/// A plain Cupertino text button, trailing, in muted ink: the composer stays
/// the screen's one primary action, and closing the day is the quiet second
/// option. Once closed, a muted line takes its place — the write is one-way,
/// so there is nothing left to offer.
class TodayCloseRow extends StatelessWidget {
  const TodayCloseRow({super.key, required this.view, required this.userId});

  final FeedViewState view;
  final String userId;

  @override
  Widget build(BuildContext context) {
    const t = 'logging.feedArea.todayClose';
    final closed = view.isDayClosed;
    final label = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(LucideIcons.check300, size: LoggingIcons.size, color: kInkMuted),
        const SizedBox(width: KalloSpacing.sp1_5),
        Text(
          (closed ? '$t.closed' : '$t.markComplete').tr(),
          style: dashMeta(color: kInkMuted),
        ),
      ],
    );
    return Align(
      alignment: Alignment.centerRight,
      child:
          closed
              ? Semantics(
                liveRegion: true,
                child: SizedBox(
                  height: LoggingIcons.hit,
                  child: Center(child: label),
                ),
              )
              : CupertinoButton(
                minimumSize: const Size(LoggingIcons.hit, LoggingIcons.hit),
                padding: EdgeInsets.zero,
                onPressed: () => confirmAndCloseToday(context, view, userId),
                child: label,
              ),
    );
  }
}
