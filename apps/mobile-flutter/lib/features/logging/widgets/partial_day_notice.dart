import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../logic/logging_spacing.dart';

/// "This day may be under-logged" — a past day whose logged calories fall far
/// short of target, so the trends set it aside.
///
/// It rides INSIDE the composer card, as a band across its top edge: the fix
/// for an under-logged day is to type the missing meal, so the note sits on the
/// very thing that fixes it rather than floating as one more card in the feed.
///
/// [kInkMuted] is the lightest grey in the palette that still clears 4.5:1
/// against white copy (it measures ~5.2:1). Anything nearer the canvas reads
/// softer but drops the text below AA — the two goals pull opposite ways, and
/// legibility wins.
///
/// Square corners on purpose: the composer card clips it, so the card's own
/// radius shapes the band's top and its bottom stays flush with the field.
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
      color: kInkMuted,
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
