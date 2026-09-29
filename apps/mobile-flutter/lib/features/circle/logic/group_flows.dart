/// The Circle's group flows, as BuildContext actions: opening the group sheet
/// (at its info, or straight on a second level), the long-press menu on a
/// group tab, the circle manager behind "All", and removing a member.
///
/// Each one that can fail answers with a toast and never rethrows.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/social/chat_group.dart';
import '../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../data/chat_group_providers.dart';
import '../screens/circle_manage_screen.dart';
import '../widgets/groups/info/group_info_sheet.dart';

/// Opens the group sheet for [groupId], at [initial].
Future<void> showGroupInfoSheet(
  BuildContext context,
  String groupId, {
  GroupSheetLevel initial = GroupSheetLevel.info,
  String initialName = '',
}) => showNhamSheet<void>(
  context,
  builder:
      (_) => GroupInfoSheet(
        groupId: groupId,
        initial: initial,
        initialName: initialName,
      ),
);

/// "All" has no group sheet; its second tap opens the circle manager —
/// friends, groups, blocked people — the page Settings also pushes.
Future<void> openCircleManager(BuildContext context) => Navigator.of(
  context,
).push(
  MaterialPageRoute<void>(
    builder: (_) => CircleManageScreen(parentTitle: tr('groups.page.title')),
  ),
);

enum _TabAction { view, add, rename }

/// The long-press menu on a group tab: the app's anchored menu hanging off
/// the tab, which stays where it is (no lifted copy, no blur — the page stays
/// sharp, as for a pull-down). It offers only what the viewer may do, so the
/// detail is loaded first: rename is the owner's.
Future<void> openGroupTabMenu(
  BuildContext context, {
  required String groupId,
  required Rect anchor,
}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final provider = chatGroupDetailProvider(groupId);
  final ChatGroupDetail group;
  try {
    group = await container.read(provider.future);
  } catch (_) {
    container.invalidate(provider);
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.manage.groupLoadError'),
        variant: TopToastVariant.error,
      );
    }
    return;
  }
  if (!context.mounted) return;
  final action = await showKalloAnchoredMenu<_TabAction>(
    context,
    anchor: anchor,
    edge: KalloMenuEdge.leading,
    backdrop: false,
    actions: [
      KalloMenuAction(
        label: tr('groups.switcher.viewGroup'),
        icon: LucideIcons.users300,
        value: _TabAction.view,
      ),
      KalloMenuAction(
        label: tr('groups.info.addMembers'),
        icon: LucideIcons.userPlus300,
        value: _TabAction.add,
      ),
      if (group.myRole == 'owner')
        KalloMenuAction(
          label: tr('groups.info.renameLabel'),
          icon: LucideIcons.pencil300,
          value: _TabAction.rename,
        ),
    ],
  );
  if (action == null || !context.mounted) return;
  await showGroupInfoSheet(
    context,
    groupId,
    initial: switch (action) {
      _TabAction.view => GroupSheetLevel.info,
      _TabAction.add => GroupSheetLevel.add,
      _TabAction.rename => GroupSheetLevel.rename,
    },
    initialName: group.name ?? '',
  );
}

/// Renames [groupId]; a failure is a toast. Returns whether it landed.
Future<bool> renameGroupFlow(
  BuildContext context, {
  required String groupId,
  required String name,
}) => _mutate(
  context,
  () => renameChatGroup(
    ProviderScope.containerOf(context, listen: false),
    groupId: groupId,
    name: name,
  ),
  failed: 'groups.info.renameError',
);

/// Adds [userIds] to [groupId] and says so; a failure is a toast.
Future<bool> addMembersFlow(
  BuildContext context, {
  required String groupId,
  required List<String> userIds,
}) => _mutate(
  context,
  () => addGroupMembers(
    ProviderScope.containerOf(context, listen: false),
    groupId: groupId,
    memberUserIds: userIds,
  ),
  done: 'groups.info.added',
  failed: 'groups.info.addError',
);

Future<bool> _mutate(
  BuildContext context,
  Future<void> Function() action, {
  String? done,
  required String failed,
}) async {
  try {
    await action();
  } catch (_) {
    if (context.mounted) {
      showTopToast(context, tr(failed), variant: TopToastVariant.error);
    }
    return false;
  }
  if (done != null && context.mounted) showTopToast(context, tr(done));
  return true;
}

/// Confirms, then removes [member] from [groupId].
///
/// "Xoá {name}?" — "Xoá" against "Giữ lại": the member goes, or stays. Both
/// options are verbs, so this does not share `moderation_flows`' "Cancel".
Future<bool> removeGroupMemberFlow(
  BuildContext context, {
  required String groupId,
  required ChatGroupMember member,
}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final confirmed = await showKalloConfirm(
    context,
    title: tr('groups.info.removeTitle', namedArgs: {'name': member.label}),
    description: tr('groups.info.removeDescription'),
    confirmLabel: tr('common.actions.remove'),
    cancelLabel: tr('common.actions.keep'),
    destructive: true,
  );
  if (!confirmed || !context.mounted) return false;
  try {
    await removeGroupMember(container, groupId: groupId, userId: member.userId);
    return true;
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.info.removeError'),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
}
