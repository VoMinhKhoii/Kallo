import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../logic/bucket_detail.dart';
import '../logic/helpers.dart';

/// The breakdown for one tapped column: macros on top, then that bucket's
/// micronutrients as percentages of target. Every figure is read from the
/// `daySeries` the page already loaded, so opening this costs no request.
class BucketDetail extends StatelessWidget {
  const BucketDetail({
    super.key,
    required this.detail,
    required this.locale,
    required this.onClose,
  });

  final BucketDetailData detail;
  final String locale;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final calories =
        detail.macros.where((m) => m.metric == 'calories').firstOrNull;
    final macros = detail.macros.where((m) => m.metric != 'calories').toList();

    return Container(
      margin: const EdgeInsets.only(top: NhamSpacing.sp3),
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: kPage,
        borderRadius: BorderRadius.circular(NhamRadii.lg),
        border: Border.all(color: kHairline),
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
                      formatBucketRange(
                          detail.startDate, detail.endDate, locale),
                      style: dashMeta(color: kInk)
                          .copyWith(fontWeight: FontWeight.w500),
                    ),
                    if (calories != null)
                      Text(
                        '${formatLocalizedNumber(calories.value, locale)} '
                        '${tr('nutrition.rhythm.calories')}'
                        '${detail.isWeekBucket ? ' · ${tr('nutrition.detail.perDay')}' : ''}',
                        style: dashMeta(color: kInkMuted),
                      ),
                  ],
                ),
              ),
              Semantics(
                button: true,
                label: tr('nutrition.detail.close'),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onClose,
                  child: const Padding(
                    padding: EdgeInsets.all(NhamSpacing.sp1),
                    child: Icon(LucideIcons.x, size: 16, color: kInkMuted),
                  ),
                ),
              ),
            ],
          ),
          if (macros.isNotEmpty) ...[
            const SizedBox(height: NhamSpacing.sp2),
            Wrap(
              spacing: NhamSpacing.sp4,
              runSpacing: NhamSpacing.sp1,
              children: [
                for (final macro in macros)
                  Text(
                    '${tr(macro.labelKey)} '
                    '${formatLocalizedNumber(macro.value, locale)}${macro.unit}',
                    style: dashMeta(color: kInk),
                  ),
              ],
            ),
          ],
          const SizedBox(height: NhamSpacing.sp2),
          const Divider(height: 1, color: kHairline),
          const SizedBox(height: NhamSpacing.sp2),
          if (detail.nutrients.isEmpty)
            Text(
              tr('nutrition.detail.noNutrients'),
              style: dashMeta(color: kInkMuted),
            )
          else
            _NutrientRows(nutrients: detail.nutrients, locale: locale),
        ],
      ),
    );
  }
}

/// Two columns of `label … figure`, matching the nutrient grid's density.
class _NutrientRows extends StatelessWidget {
  const _NutrientRows({required this.nutrients, required this.locale});

  final List<BucketMetric> nutrients;
  final String locale;

  String _figure(BucketMetric nutrient) {
    final pct = nutrient.percentOfTarget;
    if (pct == null) {
      return '${formatLocalizedNumber(nutrient.value, locale)} ${nutrient.unit}';
    }
    return tr('nutrition.steady.percent',
        namedArgs: {'value': pct.round().toString()});
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Two columns, minus the inter-column gap.
        final columnWidth = (constraints.maxWidth - NhamSpacing.sp4) / 2;
        return Wrap(
          spacing: NhamSpacing.sp4,
          runSpacing: NhamSpacing.sp1,
          children: [
            for (final nutrient in nutrients)
              SizedBox(
                width: columnWidth,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(
                        tr(nutrient.labelKey),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: dashMeta(color: kInkMuted),
                      ),
                    ),
                    const SizedBox(width: NhamSpacing.sp2),
                    Text(_figure(nutrient), style: dashMeta(color: kInk)),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
