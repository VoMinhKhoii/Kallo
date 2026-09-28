import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// The group sheet's one row anatomy: a 36pt [leading] disc, the [label],
/// and an optional [trailing] — a member ("Owner"), a friend to add (the
/// round check) and the "Add members" row are all this row.
///
/// Not `ListRow`: that row's leading slot is a 24pt glyph column, and these
/// lead with a 36pt face. The row pads itself (16pt) rather than relying on a
/// padded card, so a swipe can open from the card's edge.
class GroupPersonRow extends StatelessWidget {
  const GroupPersonRow({
    required this.leading,
    required this.label,
    this.trailing,
    this.onTap,
    this.selected,
    super.key,
  });

  final Widget leading;
  final String label;
  final Widget? trailing;

  /// Makes the whole row one press target.
  final VoidCallback? onTap;

  /// Spoken selection state, for a row that picks (the add page's friends).
  final bool? selected;

  static const double height = 56;
  static const double face = 36;

  /// Where the label starts — the separators between rows line up with it.
  static const double textInset = KalloSpacing.sp4 + face + KalloSpacing.sp3;

  @override
  Widget build(BuildContext context) {
    final row = Container(
      height: height,
      color: kCardSurface,
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      child: Row(
        children: [
          SizedBox.square(dimension: face, child: leading),
          const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          if (trailing case final trailing?) trailing,
        ],
      ),
    );
    final tap = onTap;
    if (tap == null) return row;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed: () {
          if (selected != null) HapticFeedback.selectionClick();
          tap();
        },
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(KalloIcons.hit),
        child: row,
      ),
    );
  }
}
