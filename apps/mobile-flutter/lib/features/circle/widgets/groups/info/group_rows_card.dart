import 'package:flutter/material.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_shapes.dart';
import '../../../../../theme/kallo_theme.dart';
import 'group_person_row.dart';

/// A muted [label] over one white grouped card of [rows], hairlines inset to
/// the rows' label column — the members on the info page, the friends on the
/// add page.
///
/// Not `GroupedListCard`: that card pads its rows 16pt, and these rows pad
/// themselves so a swipe opens from the card's edge. The card only clips
/// them to its shape.
class GroupRowsCard extends StatelessWidget {
  const GroupRowsCard({
    required this.label,
    required this.rows,
    this.labelTrailing,
    super.key,
  });

  final String label;

  /// A marker at the label's end (the Premium chip).
  final Widget? labelTrailing;

  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            0,
            KalloSpacing.sp4,
            KalloSpacing.sp1_5,
          ),
          child: Row(
            children: [
              Expanded(child: Text(label, style: kGroupLabel())),
              if (labelTrailing case final marker?) marker,
            ],
          ),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: ShapeDecoration(
            color: kCardSurface,
            shape: KalloShapes.squircle(KalloRadii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0)
                  Container(
                    height: 1,
                    margin: const EdgeInsets.only(
                      left: GroupPersonRow.textInset,
                    ),
                    color: kHairline,
                  ),
                rows[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}
