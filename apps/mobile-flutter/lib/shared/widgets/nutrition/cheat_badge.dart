import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The accent-tinted "Cheat meal" badge with the PartyPopper icon (never red).
///
/// Shared by the live slider card, the persisted cheat card, and a friend's
/// cheat post in the circle feed; each passes its own localized [label].
///
/// Promoted out of `features/logging/widgets/cheat/cheat_slider_card.dart` when
/// circle became the third consumer: that file is 556 lines and frozen, and
/// importing a logging widget from a circle widget is the cross-feature reach
/// the Flutter AGENTS.md §3 forbids.
class CheatBadge extends StatelessWidget {
  const CheatBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: KalloColors.accent15,
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.partyPopper300, size: 12, color: kInk),
          const SizedBox(width: 4),
          Text(label, style: dashMeta(color: kInk)),
        ],
      ),
    );
  }
}
