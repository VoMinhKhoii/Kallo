import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

import 'macro_columns.dart';

/// `P: 65g  C: 0g  F: 2g` in the shared cells: labels at one fixed x, figures
/// at another a label-width over.
///
/// [dashCaption] still asks for tabular figures. Be Vietnam Pro ignores `tnum`, so
/// it buys nothing here — but the request costs nothing and holds if the family
/// ever ships the feature.
class MacroSplit extends StatelessWidget {
  const MacroSplit({
    super.key,
    required this.protein,
    required this.carbs,
    required this.fat,
  });

  final double? protein;
  final double? carbs;
  final double? fat;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Cell(label: 'P:', grams: protein),
        const SizedBox(width: MacroColumns.cellGap),
        _Cell(label: 'C:', grams: carbs),
        const SizedBox(width: MacroColumns.cellGap),
        _Cell(label: 'F:', grams: fat),
      ],
    );
  }
}

/// `P:` in a box of its own, then `49g` starting at that box's edge.
///
/// Both runs are pinned LEFT, so the labels form a column and the figures form
/// a column one label-width over — with only the slack inside the label box
/// (1.3pt at `C:`, 2.8pt at `P:`) between a label and its own number. The unit
/// rides along with the digit it belongs to and lands wherever that leaves it;
/// the trailing air stays inside the cell, so the next macro still starts at a
/// fixed x.
class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.grams});

  final String label;
  final double? grams;

  @override
  Widget build(BuildContext context) {
    // Caption, not Meta. This is the card's densest component: three
    // label+figure cells sharing one row with a 16pt dish name and a 74pt
    // kcal column, inside the 334pt a row really gets on a 390pt phone. At
    // Meta the cells grew to ~54 each and squeezed the name column under what
    // a real dish name needs for its longest word ("Top blade"), so "Top
    // blade áp chảo" no longer fit the two lines it is allowed. At Meta 14 it
    // would now fit by ~3pt on a 390 phone, but not at 1.3x Dynamic Type and
    // not on the totals row. The figures are a dense numeric cluster, the
    // name is reading text: the cluster gives way.
    final style = dashCaption(tabular: true);
    final value = grams == null ? 'N/A' : '${grams!.round()}g';

    Widget fit(String text) => Align(
      alignment: Alignment.centerLeft,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(text, maxLines: 1, softWrap: false, style: style),
      ),
    );

    return SizedBox(
      width: MacroColumns.cell,
      child: Row(
        children: [
          SizedBox(width: MacroColumns.label, child: fit(label)),
          Expanded(child: fit(value)),
        ],
      ),
    );
  }
}
