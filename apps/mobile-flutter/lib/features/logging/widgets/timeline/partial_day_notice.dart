import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/logic/display_format.dart' show formatCount;
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

/// "This day may be under-logged" — a past day whose logged calories fall far
/// short of target, so the trends set it aside.
///
/// It rides INSIDE the composer card, as its own inset rounded block above the
/// field: one fix for an under-logged day is to type the missing meal, so the
/// note sits on the very thing that fixes it rather than floating as one more
/// card in the feed. The other fix is the button — the day really was light —
/// which is why the block carries an action and not just an apology.
///
/// The band paints [KalloColors.bandSurface], NOT `kInkMuted`. The muted ink
/// token was lightened to `#7A7870` on 2026-09-02, which drops white copy on it
/// to 4.44:1 — under AA. `bandSurface` is pinned at the pre-lightening
/// `#6E6D66` (~5.2:1) precisely so this band cannot drift with the text token,
/// and the comment on that token says so.
class PartialDayNotice extends StatelessWidget {
  const PartialDayNotice({
    super.key,
    required this.calories,
    required this.target,
    required this.onDismiss,
    required this.onMarkComplete,
  });

  final int calories;
  final int target;

  /// Dismiss for this day. The condition is still true after dismissal — the
  /// user has simply read it — so it comes back when the day changes.
  final VoidCallback onDismiss;

  /// Attest that this day is fully logged. One-way, so the caller confirms
  /// first; this widget only reports the tap.
  final VoidCallback onMarkComplete;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp2_5,
        KalloSpacing.sp2,
        KalloSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: KalloColors.bandSurface,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'logging.feedArea.partialDayNotice.title'.tr(),
                      style: dashBody(color: KalloColors.bandForeground),
                    ),
                    const SizedBox(height: LoggingSpacing.row),
                    Text(
                      'logging.feedArea.partialDayNotice.body'.tr(
                        namedArgs: {
                          'calories': formatCount(calories, locale),
                          'target': formatCount(target, locale),
                        },
                      ),
                      style: dashMeta(color: KalloColors.bandForeground),
                    ),
                  ],
                ),
              ),
              _DismissButton(onTap: onDismiss),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2_5),
          _MarkCompleteButton(onTap: onMarkComplete),
        ],
      ),
    );
  }
}

/// The way out for a day that really was light.
///
/// A white capsule on the band: the band is the darkest surface the logging
/// screen paints, so the affordance has to come forward off it rather than sit
/// as another muted shape on it. Ink on white is the app's ordinary reading
/// pair, so no third "on-band" text colour is introduced.
class _MarkCompleteButton extends StatelessWidget {
  const _MarkCompleteButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: LoggingIcons.hit),
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3_5),
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.check300,
                size: LoggingIcons.size,
                color: kInk,
              ),
              const SizedBox(width: KalloSpacing.sp2),
              Text(
                'logging.feedArea.partialDayNotice.markComplete'.tr(),
                style: dashBody(color: kInk, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
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
        child: const SizedBox.square(
          dimension: LoggingIcons.hit,
          child: Align(
            alignment: Alignment.topRight,
            child: Icon(
              LucideIcons.x300,
              size: LoggingIcons.size,
              color: KalloColors.bandForeground70,
            ),
          ),
        ),
      ),
    );
  }
}
