import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/chat_group.dart';
import '../../../../models/social/moderation.dart';
import '../../../../shared/widgets/surface/kallo_small_button.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
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

  /// The viewer's permissions for this group. Loaded before the sheet opens
  /// when the watched detail has not landed yet — never guessed — and a load
  /// that fails is a toast and a retry on the next tap, not a menu that
  /// offers what the server will refuse.
  Future<({bool report, bool leave})?> _allowed(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final provider = chatGroupDetailProvider(group.id);
    try {
      return groupActionsFor(await ref.read(provider.future));
    } catch (_) {
      ref.invalidate(provider);
      if (context.mounted) {
        showTopToast(
          context,
          tr('groups.manage.groupLoadError'),
          variant: TopToastVariant.error,
        );
      }
      return null;
    }
  }

  Future<void> _openMenu(BuildContext context, WidgetRef ref) async {
    final allowed = await _allowed(context, ref);
    if (allowed == null || !context.mounted) return;
    if (!allowed.report && !allowed.leave) return;
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
    // Watched so the role is usually in hand before the tap (the sheet opens
    // at once) and so a menu KNOWN to be empty draws no `⋯` at all. While the
    // role is unknown the `⋯` stays: [_openMenu] loads it first.
    final detail = ref.watch(chatGroupDetailProvider(group.id)).valueOrNull;
    final allowed = detail == null ? null : groupActionsFor(detail);
    final hasMenu = allowed == null || allowed.report || allowed.leave;
    return ManageRow(
      leading: const _GroupDisc(),
      title: group.title,
      trailing: [
        const SizedBox(width: KalloSpacing.sp2),
        KalloSmallButton(
          label: tr('groups.manage.goToCircle'),
          onPressed: () => _goToCircle(context, ref),
        ),
        if (hasMenu)
          MoreButton(
            name: group.title,
            onPressed: () => _openMenu(context, ref),
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
