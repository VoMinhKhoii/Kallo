/// The group sheet's member actions, as BuildContext flows: each asks first,
/// calls the data layer (`data/chat_group_providers.dart`) and answers a
/// failure with a toast. Never rethrows; returns whether anything changed.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/chat_group.dart';
import '../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../data/chat_group_providers.dart';

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
