import 'package:flutter/material.dart';

import 'grouped_list_card.dart';

/// The fill behind a [ListRow] while it is pressed or selected.
///
/// It runs edge to edge of the card, past the card's own side padding, so the
/// card's clip gives it the card's corners: inside the padding it read as a
/// square tab stuck to the card.
///
/// A SELECTED row's wash also runs over the separators either side of it (the
/// card leaves those unpainted), so it has no seam along its edge. A press
/// keeps them: it is gone in 150ms.
class ListRowWash extends StatelessWidget {
  const ListRowWash({
    super.key,
    required this.color,
    required this.pressed,
    required this.selected,
  });

  final Color color;
  final bool pressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final double overlap = selected ? GroupedListCard.separatorHeight : 0;
    return Positioned(
      left: -GroupedListCard.contentInset,
      right: -GroupedListCard.contentInset,
      top: -overlap,
      bottom: -overlap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        color: pressed || selected ? color : Colors.transparent,
      ),
    );
  }
}
