import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../shared/widgets/list/list_row.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import '../group_face_cluster.dart';
import 'group_hero.dart';
import 'group_members_card.dart';

/// The group sheet's first level, laid out as iOS lays out a group's info:
/// grouped white cards on the canvas — the members (with "Add members" as
/// their first row), then "Leave group" alone in a red row of its own.
class GroupInfoPage extends StatelessWidget {
  const GroupInfoPage({
    required this.group,
    required this.selfId,
    required this.onAdd,
    required this.onRename,
    required this.onRemove,
    required this.onRemoved,
    required this.onLeave,
    super.key,
  });

  final ChatGroupDetail group;
  final String? selfId;
  final VoidCallback onAdd;
  final VoidCallback onRename;
  final Future<bool> Function(ChatGroupMember member) onRemove;
  final ValueChanged<String> onRemoved;

  /// Null hides "Leave group": an owner cannot leave while others remain
  /// (`group_permissions.dart`), so the row would only ever fail.
  final VoidCallback? onLeave;

  @override
  Widget build(BuildContext context) {
    final isOwner = group.myRole == 'owner';
    final canSwipe = isOwner && group.members.length > 1;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The faces ride IN the header row, centred between the close circle
        // and its mirror, so the sheet does not open on an empty band above
        // them (owner review, 2026-09-29).
        KalloSheetHeader(
          // 8pt down: the grabber sits 8–13pt from the top, and the row
          // starts at 12, so the faces would otherwise touch it.
          titleWidget: Padding(
            padding: const EdgeInsets.only(top: KalloSpacing.sp2),
            child: GroupFaceCluster(
              members: group.members,
              size: 56,
              ringColor: kPage,
            ),
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              0,
              KalloSpacing.sp4,
              KalloSpacing.sp6 + MediaQuery.paddingOf(context).bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GroupHero(group: group, onRename: isOwner ? onRename : null),
                const SizedBox(height: KalloSpacing.sp6),
                _Label(tr('groups.info.membersHeading')),
                GroupMembersCard(
                  group: group,
                  selfId: selfId,
                  onAdd: onAdd,
                  onRemove: onRemove,
                  onRemoved: onRemoved,
                ),
                if (canSwipe)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      KalloSpacing.sp4,
                      KalloSpacing.sp2,
                      KalloSpacing.sp4,
                      0,
                    ),
                    child: Text(tr('groups.info.swipeHint'), style: dashMeta()),
                  ),
                if (onLeave != null) ...[
                  const SizedBox(height: KalloSpacing.sp6),
                  GroupedListCard(
                    children: [
                      ListRow(
                        icon: LucideIcons.logOut300,
                        label: tr('groups.feed.leave'),
                        danger: true,
                        onTap: onLeave,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The muted label above a grouped card, inset to the card's text line.
class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      KalloSpacing.sp4,
      0,
      KalloSpacing.sp4,
      KalloSpacing.sp1_5,
    ),
    child: Text(text, style: kGroupLabel()),
  );
}
