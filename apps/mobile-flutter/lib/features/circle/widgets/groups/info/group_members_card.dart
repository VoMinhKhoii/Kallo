import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import 'group_member_row.dart';
import 'group_person_row.dart';
import 'group_rows_card.dart';

/// The members as one grouped card: "Add members" first, then each person —
/// the owner (and nobody else) able to swipe someone out.
class GroupMembersCard extends StatelessWidget {
  const GroupMembersCard({
    required this.group,
    required this.selfId,
    required this.onAdd,
    required this.onRemove,
    required this.onRemoved,
    super.key,
  });

  final ChatGroupDetail group;

  /// The signed-in user, so their own row reads "You" and never swipes.
  final String? selfId;

  final VoidCallback onAdd;
  final Future<bool> Function(ChatGroupMember member) onRemove;
  final ValueChanged<String> onRemoved;

  String? _role(ChatGroupMember member) {
    final parts = [
      if (member.userId == selfId) tr('groups.info.you'),
      if (member.role == 'owner') tr('groups.info.owner'),
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  bool _removable(ChatGroupMember member) =>
      group.myRole == 'owner' &&
      member.role != 'owner' &&
      member.userId != selfId;

  @override
  Widget build(BuildContext context) {
    return GroupRowsCard(
      label: tr('groups.info.membersHeading'),
      rows: [
        GroupPersonRow(
          leading: const DecoratedBox(
            decoration: BoxDecoration(color: kTrack, shape: BoxShape.circle),
            child: Icon(
              LucideIcons.plus300,
              size: KalloIcons.tertiary,
              color: kInk,
            ),
          ),
          label: tr('groups.info.addMembers'),
          trailing: const Icon(
            LucideIcons.chevronRight300,
            size: KalloIcons.tertiary,
            color: kInkMuted,
          ),
          onTap: onAdd,
        ),
        for (final member in group.members)
          GroupMemberRow(
            key: ValueKey(member.userId),
            profile: member,
            role: _role(member),
            onRemove: _removable(member) ? () => onRemove(member) : null,
            onRemoved: () => onRemoved(member.userId),
          ),
      ],
    );
  }
}
