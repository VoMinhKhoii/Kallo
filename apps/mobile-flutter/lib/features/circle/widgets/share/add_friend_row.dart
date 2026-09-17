import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// A friend who is NOT yet at the table.
///
/// The share sheet's list is add-only: anyone already sharing the meal is a pin
/// above the meter and disappears from here, so nothing is ever listed twice
/// and there is no checkmark column to scan. The whole row is the target —
/// there is no trailing `+`, because the row does only one thing.
class AddFriendRow extends StatelessWidget {
  const AddFriendRow({
    required this.profile,
    required this.onTap,
    this.enabled = true,
    super.key,
  });

  final CircleProfile profile;
  final VoidCallback onTap;

  /// False once the table is full. The row stays visible and legible rather
  /// than vanishing, so the list does not reshuffle under the finger.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: profile.label,
      excludeSemantics: true,
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: enabled
              ? () {
                  HapticFeedback.selectionClick();
                  onTap();
                }
              : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: KalloIcons.hit),
            padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
            child: Row(
              children: [
                ProfileAvatarDisc(profile: profile, size: 32),
                const SizedBox(width: KalloSpacing.sp3),
                Expanded(child: Text(profile.label, style: dashBody())),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
