import 'package:flutter/material.dart';

import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../logic/settings_spacing.dart';

/// A labelled settings section: a [GroupLabel] above one white
/// [GroupedListCard] of rows.
///
/// The rows used to sit FLAT on the canvas, grouped by whitespace alone. The
/// native pass (2026-08-31) puts them inside the Apple-grouped card the rest
/// of the app now uses — and Settings is the anchor that anatomy was
/// generalized from, so this is a wrapper over the shared primitives, not a
/// second implementation of them. The label keeps NO extra indent: it starts
/// on the page's own 12pt inset, and the card's 16pt padding is what steps the
/// rows in from it.
///
/// A group with nothing to show must occupy no space at all — the parent stack
/// puts a gap on each side of it, and a header floating above zero rows (or an
/// empty card) would strand both of them as a void.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupLabel(label),
        const SizedBox(height: SettingsSpacing.label),
        GroupedListCard(children: children),
      ],
    );
  }
}
