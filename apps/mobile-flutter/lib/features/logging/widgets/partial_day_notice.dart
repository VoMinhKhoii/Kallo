import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../logic/logging_spacing.dart';

/// "This day may be under-logged" — a past day whose logged calories fall far
/// short of target, so the trends set it aside.
///
/// It rides at the TOP of the composer dock, not in the feed: the fix for an
/// under-logged day is to type the missing meal, and the note now sits directly
/// on the thing that fixes it. That makes it composer chrome rather than a feed
/// card, so it is styled as one — a dark [NhamColors.textSoft] slab with white
/// copy, instead of another white bordered card competing with the meal cards
/// scrolling behind it.
class PartialDayNotice extends StatelessWidget {
  const PartialDayNotice({
    super.key,
    required this.calories,
    required this.target,
  });

  final int calories;
  final int target;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: NhamColors.textSoft,
        // Matches the composer card it sits above, so the dock reads as one
        // stack of rounded blocks rather than two unrelated shapes.
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'logging.feedArea.partialDayNotice.title'.tr(),
            style: dashBody(weight: FontWeight.w500, color: Colors.white),
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
    );
  }
}
