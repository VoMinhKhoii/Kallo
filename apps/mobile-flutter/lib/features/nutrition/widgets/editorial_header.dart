import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/format_date.dart';
import 'fade_in_down.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/editorial-header.tsx`.
class EditorialHeader extends StatelessWidget {
  const EditorialHeader({
    super.key,
    required this.startDate,
    required this.endDate,
    this.verdict,
  });

  final String startDate;
  final String endDate;

  /// The verdict line — rendered full-width below the title row on phone.
  final Widget? verdict;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final dateRange = tr(
      'nutrition.editorial.dateRange',
      namedArgs: {
        'start': formatDate(startDate, locale),
        'end': formatDate(endDate, locale),
      },
    );

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: NhamColors.borderHalf)),
      ),
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FadeInDown(
            offset: 6,
            child: Text(
              dateRange,
              style: NhamTextStyles.sansRegular(fontSize: 14).copyWith(
                color: NhamColors.textMuted,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          if (verdict != null) ...[
            const SizedBox(height: 12),
            // Verdict: web opacity/y:4 duration 0.5 delay 0.1.
            FadeInDown(
              offset: 4,
              delay: const Duration(milliseconds: 100),
              child: SizedBox(width: double.infinity, child: verdict),
            ),
          ],
        ],
      ),
    );
  }
}
