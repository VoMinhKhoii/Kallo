import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// One row of the "Edit circle" lists — a 44pt leading disc, the name, an
/// optional muted second line, and whatever the row offers on its trailing
/// edge.
///
/// Plain on the canvas, no card: these are long lists of people and groups
/// (Instagram's followers list, which the user pointed at), and a white card
/// per row, or one card around fifty rows, would be more surface than
/// content. The rows separate by the 12pt rhythm alone.
class ManageRow extends StatelessWidget {
  const ManageRow({
    super.key,
    required this.leading,
    required this.title,
    this.subline,
    this.trailing = const [],
  });

  final Widget leading;
  final String title;
  final String? subline;

  /// Left to right. The `⋯` is always last, so it lines up down the list.
  final List<Widget> trailing;

  /// The leading disc — the person's avatar, or a group's glyph disc.
  static const double disc = 44;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: disc + KalloSpacing.sp3),
      child: Row(
        children: [
          SizedBox.square(dimension: disc, child: leading),
          const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(),
                ),
                if (subline != null)
                  Text(
                    subline!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: dashMeta(),
                  ),
              ],
            ),
          ),
          ...trailing,
        ],
      ),
    );
  }
}
