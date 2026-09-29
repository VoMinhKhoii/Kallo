import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'group_person_row.dart';

/// One person in the group card, with a quiet role on the right.
///
/// **Removal is a trailing swipe, not an X on every row.** The X put a
/// destructive control one tap from every name, in the same column the eye
/// scans; the iOS list idiom hides it behind a deliberate gesture and still
/// confirms. A long press (and the matching VoiceOver action) reaches the
/// same confirm for anyone who does not swipe.
class GroupMemberRow extends StatelessWidget {
  const GroupMemberRow({
    required this.profile,
    required this.role,
    this.onRemove,
    this.onRemoved,
    super.key,
  });

  final CircleProfile profile;

  /// Quiet role text ("Owner", "You · Owner"), or null.
  final String? role;

  /// Confirms and performs the removal; resolves true once the member is
  /// gone. Null makes the row inert (not the owner, or the owner's own row).
  final Future<bool> Function()? onRemove;

  /// Fired after a successful removal, so the list can drop the row at once
  /// instead of waiting for the refetch.
  final VoidCallback? onRemoved;

  @override
  Widget build(BuildContext context) {
    final role = this.role;
    final row = GroupPersonRow(
      leading: ProfileAvatarDisc(profile: profile, size: GroupPersonRow.face),
      label: profile.label,
      trailing: role == null ? null : Text(role, style: dashMeta()),
    );
    final remove = onRemove;
    if (remove == null) {
      return Semantics(
        label: [profile.label, if (role != null) role].join(', '),
        excludeSemantics: true,
        child: row,
      );
    }
    Future<void> removeFromMenu() async {
      if (await remove()) onRemoved?.call();
    }

    final removeLabel = tr(
      'groups.info.removeLabel',
      namedArgs: {'name': profile.label},
    );
    return Semantics(
      label: profile.label,
      customSemanticsActions: {
        CustomSemanticsAction(label: removeLabel): removeFromMenu,
      },
      excludeSemantics: true,
      child: GestureDetector(
        onLongPress: removeFromMenu,
        child: Dismissible(
          key: ValueKey('group-member-${profile.userId}'),
          direction: DismissDirection.endToStart,
          confirmDismiss: (_) => remove(),
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
