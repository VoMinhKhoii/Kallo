import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/chat_group.dart';
import '../../../../models/social/moderation.dart';
import '../../../../shared/widgets/surface/kallo_small_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/chat_group_providers.dart';
import '../../data/feed_providers.dart';
import '../../logic/group_permissions.dart';
import '../../logic/moderation_flows.dart';
import '../moderation/circle_action_sheet.dart';
import 'manage_row.dart';
import 'more_button.dart';

enum _GroupAction { report, leave }

/// A group the viewer is in: a glyph disc, its name, "Go to circle", and the
/// quiet `⋯` holding Report group and Leave group — each only when the
/// viewer may take it ([groupActionsFor]).
///
/// "Go to circle" is the row's one positive action — a small outline squircle
/// ([KalloSmallButton]) — so the list reads as places to go, not things to
/// get rid of.
class GroupRow extends ConsumerWidget {
  const GroupRow({super.key, required this.group});

  final ChatGroupIdentity group;

  /// Opens the Circle tab on this group's feed. `go`, not `push`: the Circle
  /// tab is a shell branch, and this page sits on a root route above the
  /// shell, so going there replaces the settings stack rather than stacking a
  /// second shell on top of it. The selection is what `CircleScreen` reads.
  void _goToCircle(BuildContext context, WidgetRef ref) {
    ref.read(circleSelectedViewProvider.notifier).state = group.id;
    GoRouter.of(context).go('/circle');
  }

  Future<void> _openMenu(
    BuildContext context,
    WidgetRef ref,
    ({bool report, bool leave}) allowed,
  ) async {
    final action = await showCircleActionSheet<_GroupAction>(
      context,
      title: group.title,
      actions: [
        if (allowed.report)
          CircleSheetAction(
            label: tr('groups.moderation.reportGroup'),
            value: _GroupAction.report,
          ),
        if (allowed.leave)
          CircleSheetAction(
            label: tr('groups.feed.leave'),
            value: _GroupAction.leave,
            destructive: true,
          ),
      ],
    );
    if (action == null || !context.mounted) return;
    switch (action) {
      case _GroupAction.report:
        await reportFlow(
          context,
          ref,
          kind: ReportTargetKind.chatGroup,
          targetId: group.id,
        );
      case _GroupAction.leave:
        await leaveGroupFlow(context, ref, group.id);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The viewer's role decides what the menu may offer (see
    // [groupActionsFor]). Watched, not read on tap, so the sheet opens at once
    // and a menu with nothing left in it never shows a `⋯` at all.
    final allowed = groupActionsFor(
      ref.watch(chatGroupDetailProvider(group.id)).valueOrNull,
    );
    return ManageRow(
      leading: const _GroupDisc(),
      title: group.title,
      trailing: [
        const SizedBox(width: KalloSpacing.sp2),
        KalloSmallButton(
          label: tr('groups.manage.goToCircle'),
          onPressed: () => _goToCircle(context, ref),
        ),
        if (allowed.report || allowed.leave)
          MoreButton(
            name: group.title,
            onPressed: () => _openMenu(context, ref, allowed),
          )
        else
          // Keeps "Go to circle" aligned with the rows that do have a `⋯`.
          const SizedBox(width: KalloIcons.hit),
      ],
    );
  }
}

/// A group's disc: the people glyph on the warm track, so a group never reads
/// as one person's initials.
class _GroupDisc extends StatelessWidget {
  const _GroupDisc();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
    decoration: BoxDecoration(color: KalloColors.track, shape: BoxShape.circle),
    child: Center(
      child: Icon(LucideIcons.users300, size: KalloIcons.action, color: kInk),
    ),
  );
}
