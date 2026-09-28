import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_shapes.dart';
import '../../../../../theme/kallo_theme.dart';
import 'group_member_row.dart';

/// The members as one grouped card: "Add members" first, then each person.
///
/// Not a `GroupedListCard`: that card pads its rows 16pt from its edge, which
/// is right for text rows and wrong for a swipe — the red would open inside a
/// white margin instead of from the card's edge. Here the rows pad
/// themselves and the card only clips them to its shape.
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

  bool get _isOwner => group.myRole == 'owner';

  String? _trailing(ChatGroupMember member) {
    final parts = [
      if (member.userId == selfId) tr('groups.info.you'),
      if (member.role == 'owner') tr('groups.info.owner'),
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      _AddRow(onTap: onAdd),
      for (final member in group.members)
        GroupMemberRow(
          key: ValueKey(member.userId),
          profile: member,
          trailing: _trailing(member),
          onRemove:
              _isOwner && member.role != 'owner' && member.userId != selfId
                  ? () => onRemove(member)
                  : null,
          onRemoved: () => onRemoved(member.userId),
        ),
    ];
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: ShapeDecoration(
        color: kCardSurface,
        shape: KalloShapes.squircle(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              Container(
                height: 1,
                margin: const EdgeInsets.only(left: GroupMemberRow.textInset),
                color: kHairline,
              ),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _AddRow extends StatelessWidget {
  const _AddRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      onPressed: onTap,
      padding: EdgeInsets.zero,
      minimumSize: const Size.square(KalloIcons.hit),
      child: Container(
        height: GroupMemberRow.height,
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: kTrack,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.plus300,
                size: KalloIcons.tertiary,
                color: kInk,
              ),
            ),
            const SizedBox(width: KalloSpacing.sp3),
            Expanded(
              child: Text(tr('groups.info.addMembers'), style: dashBody()),
            ),
            const Icon(
              LucideIcons.chevronRight300,
              size: KalloIcons.tertiary,
              color: kInkMuted,
            ),
          ],
        ),
      ),
    );
  }
}
