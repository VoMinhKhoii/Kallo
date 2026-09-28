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
class FriendRow extends ConsumerStatefulWidget {
  const FriendRow({super.key, required this.profile});

  final CircleProfile profile;

  @override
  ConsumerState<FriendRow> createState() => _FriendRowState();
}

class _FriendRowState extends ConsumerState<FriendRow> {
  /// True once this person has left the viewer's circle — removed or blocked.
  /// The row stays on screen while the friends list refetches (the tab keeps
  /// its data through a refresh), and a live `⋯` there would offer to remove
  /// or block them a second time, which the server refuses. So it is off until
  /// the refreshed list drops the row.
  bool _gone = false;

  /// True from the `⋯` tap until its flow ends. The confirm closes before the
  /// request is sent, so a slow block or removal would otherwise leave the
  /// `⋯` live under it — a second flow could start alongside the first
  /// (spending the rate-limited block budget, or removing then blocking in an
  /// order the first choice never meant).
  bool _busy = false;

  CircleProfile get profile => widget.profile;

  void _markGone() {
    if (mounted) setState(() => _gone = true);
  }

  Future<void> _openMenu() async {
    setState(() => _busy = true);
    try {
      await _runMenu();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runMenu() async {
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
    if (action == null || !mounted) return;
    switch (action) {
      case _FriendAction.report:
        // Reporting keeps the friend; a block from the thank-you does not.
        await reportFlow(
          context,
          ref,
          kind: ReportTargetKind.profile,
          targetId: profile.userId,
          author: profile,
          onBlocked: _markGone,
        );
      case _FriendAction.block:
        if (await blockFlow(context, ref, profile)) _markGone();
      case _FriendAction.remove:
        if (await removeFriendFlow(context, ref, profile)) _markGone();
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = profile.label;
    return ManageRow(
      leading: ProfileAvatarDisc(profile: profile, size: ManageRow.disc),
      // No handle line: the handle is the invite-link slug the server derives
      // from the name, not a username anyone chose, so it would only repeat
      // the name as a URL fragment.
      title: name,
      trailing: [
        MoreButton(name: name, onPressed: _gone || _busy ? null : _openMenu),
      ],
    );
  }
}
