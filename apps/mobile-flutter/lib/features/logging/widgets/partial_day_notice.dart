import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../logic/logging_spacing.dart';

/// "This day may be under-logged" — a past day whose logged calories fall far
/// short of target, so the trends set it aside.
///
/// It rides INSIDE the composer card, as its own inset rounded block above the
/// field: the fix for an under-logged day is to type the missing meal, so the
/// note sits on the very thing that fixes it rather than floating as one more
/// card in the feed.
///
/// [kInkMuted] is the lightest grey in the palette that still clears 4.5:1
/// against white copy (it measures ~5.2:1). Anything nearer the canvas reads
/// softer but drops the text below AA — the two goals pull opposite ways, and
/// legibility wins.
class PartialDayNotice extends StatelessWidget {
  const PartialDayNotice({
    super.key,
    required this.calories,
    required this.target,
    required this.onDismiss,
  });

  final int calories;
  final int target;

  /// Dismiss for this day. The condition is still true after dismissal — the
  /// user has simply read it — so it comes back when the day changes.
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp2_5,
        NhamSpacing.sp2,
        NhamSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: kInkMuted,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'logging.feedArea.partialDayNotice.title'.tr(),
                  style: dashBody(
                    weight: FontWeight.w500,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: LoggingSpacing.row),
                Text(
                  'logging.feedArea.partialDayNotice.body'.tr(
                    namedArgs: {
                      'calories': formatCount(calories, locale),
                      'target': formatCount(target, locale),
                    },
                  ),
                  style: dashMeta(color: Colors.white),
                ),
              ],
            ),
          ),
          _DismissButton(onTap: onDismiss),
        ],
      ),
    );
  }
}

/// The close affordance — the glyph hugs its own size while the tap target
/// stays [LoggingIcons.hit], the pattern every icon-only control here uses.
class _DismissButton extends StatelessWidget {
  const _DismissButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'common.dismiss'.tr(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox.square(
          dimension: LoggingIcons.hit,
          child: Align(
            alignment: Alignment.topRight,
            child: Icon(
              LucideIcons.x,
              size: LoggingIcons.size,
              color: Colors.white.withValues(alpha: 0.7),
            ),
          ),
        ),
      ),
    );
  }
}
