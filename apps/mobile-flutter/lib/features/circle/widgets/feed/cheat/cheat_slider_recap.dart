import 'package:flutter/material.dart';

import '../../../../../models/logging/cheat.dart';
import '../../../../../shared/logic/cheat_slider_palette.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// Where the logger put each slider, as a friend sees it on their post.
///
/// The read-only half of the owner's own "you set" block
/// (`cheat_meal_expanded_details.dart`), drawn from the same palette so a post
/// and its author's card cannot look like different meals. What it drops is
/// the eyebrow and the three-column per-axis row that block uses inside an
/// expander — a feed post has neither an expander nor the width.
class CheatSliderRecap extends StatelessWidget {
  const CheatSliderRecap({super.key, required this.rows});

  final List<CheatRecapRow> rows;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: KalloSpacing.sp3,
      runSpacing: KalloSpacing.sp1,
      children: [
        for (final row in rows)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Dots(level: row.level, color: _colorFor(row.key)),
              const SizedBox(width: 6),
              Text(row.anchorLabel, style: dashMeta()),
            ],
          ),
      ],
    );
  }

  /// The recap arrives as a wire string; an axis this build does not know
  /// falls back to the neutral track rather than dropping the row.
  Color _colorFor(String key) {
    for (final candidate in CheatSliderKey.values) {
      if (candidate.name == key) return cheatSliderColor(candidate);
    }
    return KalloColors.track;
  }
}

/// Six dots filled up to the chosen stop — the twin of web's `StopScale`.
class _Dots extends StatelessWidget {
  const _Dots({required this.level, required this.color});

  final int level;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final filled = (level / 2).round().clamp(0, 5) + 1;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 6; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < filled ? color : null,
              border:
                  i < filled
                      ? null
                      : Border.all(color: KalloColors.border, width: 1),
            ),
          ),
        ],
      ],
    );
  }
}
