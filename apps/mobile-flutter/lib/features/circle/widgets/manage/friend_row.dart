import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../models/social/moderation.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../logic/moderation_flows.dart';
import '../moderation/circle_action_sheet.dart';
import 'manage_row.dart';
import 'more_button.dart';

enum _FriendAction { report, block, remove }

/// A friend: their avatar, their name, and the quiet `⋯`
/// holding Report, Block and Remove from circle.
///
/// Report comes FIRST in the sheet, and not only because it is the mildest:
/// once a person is blocked the server no longer lets the viewer see them, so
/// a report placed after a block cannot find its target. Reporting first, then
/// offering the block on the thank-you, is the order that always works.
class FriendRow extends ConsumerWidget {
  const FriendRow({super.key, required this.profile});

  final CircleProfile profile;

  Future<void> _openMenu(BuildContext context, WidgetRef ref) async {
    final action = await showCircleActionSheet<_FriendAction>(
      context,
      title: profile.label,
      actions: [
        CircleSheetAction(
          label: tr('groups.moderation.report'),
          value: _FriendAction.report,
        ),
        CircleSheetAction(
          label: tr('groups.moderation.block'),
          value: _FriendAction.block,
          destructive: true,
        ),
        CircleSheetAction(
          label: tr('groups.moderation.removeFromCircle'),
          value: _FriendAction.remove,
          destructive: true,
        ),
      ],
    );
    if (action == null || !context.mounted) return;
    switch (action) {
      case _FriendAction.report:
        await reportFlow(
          context,
          ref,
          kind: ReportTargetKind.profile,
          targetId: profile.userId,
          author: profile,
        );
      case _FriendAction.block:
        await blockFlow(context, ref, profile);
      case _FriendAction.remove:
        await removeFriendFlow(context, ref, profile);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = profile.label;
    return ManageRow(
      leading: ProfileAvatarDisc(profile: profile, size: ManageRow.disc),
      // No handle line: the handle is the invite-link slug the server derives
      // from the name, not a username anyone chose, so it would only repeat
      // the name as a URL fragment.
      title: name,
      trailing: [
        MoreButton(name: name, onPressed: () => _openMenu(context, ref)),
      ],
    );
  }
}
