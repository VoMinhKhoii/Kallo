import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// One person in the group card: 36pt face, name, a quiet role on the right.
///
/// **Removal is a trailing swipe, not an X on every row.** The X put a
/// destructive control one tap from every name, in the same column the eye
/// scans; the iOS list idiom hides it behind a deliberate gesture and still
/// confirms. A long press (and the matching VoiceOver action) reaches the
/// same confirm for anyone who does not swipe.
class GroupMemberRow extends StatelessWidget {
  const GroupMemberRow({
    required this.profile,
    required this.trailing,
    this.onRemove,
    this.onRemoved,
    super.key,
  });

  final CircleProfile profile;

  /// Quiet role text ("Owner", "You · Owner"), or null.
  final String? trailing;

  /// Confirms and performs the removal; resolves true once the member is
  /// gone. Null makes the row inert (not the owner, or the owner's own row).
  final Future<bool> Function()? onRemove;

  /// Fired after a successful removal, so the list can drop the row at once
  /// instead of waiting for the refetch.
  final VoidCallback? onRemoved;

  /// Row height; the separator insets are measured against it.
  static const double height = 56;

  /// Where the name column starts — the separator lines up with it.
  static const double textInset = KalloSpacing.sp4 + 36 + KalloSpacing.sp3;

  Future<void> _removeFromMenu() async {
    if (await onRemove!()) onRemoved?.call();
  }

  @override
  Widget build(BuildContext context) {
    final row = Container(
      height: height,
      color: kCardSurface,
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      child: Row(
        children: [
          ProfileAvatarDisc(profile: profile, size: 36),
          const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: Text(
              profile.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          if (trailing != null) Text(trailing!, style: dashMeta()),
        ],
      ),
    );
    if (onRemove == null) {
      return Semantics(
        label: [profile.label, if (trailing != null) trailing!].join(', '),
        excludeSemantics: true,
        child: row,
      );
    }
    final removeLabel = tr(
      'groups.info.removeLabel',
      namedArgs: {'name': profile.label},
    );
    return Semantics(
      label: profile.label,
      customSemanticsActions: {
        CustomSemanticsAction(label: removeLabel): _removeFromMenu,
      },
      excludeSemantics: true,
      child: GestureDetector(
        onLongPress: _removeFromMenu,
        child: Dismissible(
          key: ValueKey('group-member-${profile.userId}'),
          direction: DismissDirection.endToStart,
          confirmDismiss: (_) => onRemove!(),
          onDismissed: (_) => onRemoved?.call(),
          background: Container(
            color: KalloColors.danger,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp5),
            child: Text(
              tr('common.actions.remove'),
              style: dashBody(color: Colors.white),
            ),
          ),
          child: row,
        ),
      ),
    );
  }
}
