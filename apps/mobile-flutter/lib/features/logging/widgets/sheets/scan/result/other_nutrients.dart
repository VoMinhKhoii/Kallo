import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';

/// One row of the "Other nutrients" page: a name, a figure and its unit.
class ScanNutrientRow {
  const ScanNutrientRow({
    required this.label,
    required this.value,
    required this.unit,
  });

  final String label;
  final double value;
  final String unit;
}

/// The result's second level: the SAME header on top (the product and its
/// macros stay in view — owner review), then the nutrients for the chosen
/// amount in one grouped card. Values the label doesn't list are not shown:
/// unknown is not 0.
class ScanOtherNutrientsPage extends StatelessWidget {
  const ScanOtherNutrientsPage({
    super.key,
    required this.header,
    required this.caption,
    required this.rows,
  });

  /// The result's `ScanResultHeader`, for the same amount.
  final Widget header;

  /// "In 1 serving · 100 ml".
  final String caption;

  final List<ScanNutrientRow> rows;

  static String _figure(double value) =>
      value == value.roundToDouble() ? '${value.round()}' : '$value';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        const SizedBox(height: KalloSpacing.sp5),
        // Flush with the card's edge, as every group label in the app.
        GroupLabel(caption),
        const SizedBox(height: 6),
        GroupedListCard(
          separatorInset: 0,
          children: [
            for (final row in rows)
              ListRow(
                label: row.label,
                trailing: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: _figure(row.value), style: dashValue()),
                      TextSpan(text: ' ${row.unit}', style: dashMeta()),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
