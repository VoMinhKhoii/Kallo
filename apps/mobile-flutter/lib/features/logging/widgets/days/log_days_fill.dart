import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// The days pane's slivers: [head], then rows that share the height the
/// viewport has left under it, so the week ends at the pane's bottom edge,
/// level with the composer beside it, and not partway down.
///
/// [rows] is told the height each row may take. It is a floor, not a size: a
/// row that needs more (large text, a short window) keeps its own height and
/// the pane scrolls.
///
/// The height is the viewport's, less [head] and the padding under the rows,
/// and never less what sits before this group: the refresh control holds its
/// spinner's height open while a refresh runs, and rows that made room for
/// it would shrink under the finger and grow back when the load lands.
class LogDaysFill extends StatelessWidget {
  const LogDaysFill({
    super.key,
    required this.head,
    required this.count,
    required this.padding,
    required this.rows,
  });

  final List<Widget> head;

  /// How many rows [rows] returns.
  final int count;

  /// Around the rows; its bottom is kept clear under the last one.
  final EdgeInsets padding;
  final List<Widget> Function(double rowHeight) rows;

  @override
  Widget build(BuildContext context) => SliverLayoutBuilder(
    builder:
        (context, group) => SliverMainAxisGroup(
          slivers: [
            ...head,
            SliverLayoutBuilder(
              builder: (context, tail) {
                final above =
                    tail.precedingScrollExtent - group.precedingScrollExtent;
                final free =
                    tail.viewportMainAxisExtent - above - padding.vertical;
                return SliverPadding(
                  padding: padding,
                  sliver: SliverList.list(
                    children: rows(math.max(0, free / count)),
                  ),
                );
              },
            ),
          ],
        ),
  );
}
