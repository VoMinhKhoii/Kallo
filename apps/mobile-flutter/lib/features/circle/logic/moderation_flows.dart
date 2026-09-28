/// The Circle's moderation flows (App Store guideline 1.2), as BuildContext
/// actions: report, block, unblock, remove a friend, leave a group.
///
/// Each one asks first, calls the data layer
/// (`data/moderation_mutations.dart`, `data/circle_providers.dart`,
/// `data/chat_group_providers.dart`) and answers with a toast. They are shared
/// by the "Edit circle" lists and the long-press on posts and replies, so the
/// same action reads the same wherever it starts.
///
/// Every flow returns whether it changed anything, so a caller that owns a
/// busy state or a list can react. None of them rethrows: a failure is a
/// toast, never an exception for the caller to handle.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../models/social/moderation.dart';
import '../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import '../data/moderation_mutations.dart';
import '../widgets/moderation/circle_action_sheet.dart';

/// The label a report reason reads as.
String reportReasonLabel(ReportReason reason) =>
    tr('groups.moderation.reasons.${reason.name}');

/// Asks why, sends the report, and thanks the person.
///
/// When the content has an [author] (a person, a post, a reply), the thank-you
/// also offers to block them — the moment someone reports is the moment they
/// most want the person gone. Reporting a group offers nothing more: leaving
/// it is a separate choice on its own menu.
Future<bool> reportFlow(
  BuildContext context,
  WidgetRef ref, {
  required ReportTargetKind kind,
  required String targetId,
  CircleProfile? author,
}) async {
  final reason = await showCircleActionSheet<ReportReason>(
    context,
    title: tr('groups.moderation.reasonTitle'),
    actions: [
      for (final reason in ReportReason.values)
        CircleSheetAction(label: reportReasonLabel(reason), value: reason),
    ],
  );
  if (reason == null || !context.mounted) return false;

  try {
    await reportCircleContent(
      ref,
      kind: kind,
      targetId: targetId,
      reason: reason,
    );
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.moderation.reportError'),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
  if (!context.mounted) return true;

  if (author == null) {
    showTopToast(context, tr('groups.moderation.reportSentBody'));
    return true;
  }
  final name = author.label;
  final block = await showKalloConfirm(
    context,
    title: tr('groups.moderation.reportSentTitle'),
    description: tr(
      'groups.moderation.reportSentBlockBody',
      namedArgs: {'name': name},
    ),
    confirmLabel: tr('groups.moderation.blockName', namedArgs: {'name': name}),
    cancelLabel: tr('groups.moderation.done'),
    destructive: true,
  );
  // The block button on the thank-you IS the confirmation: it names the
  // person and sits under what blocking means, so it does not ask again.
  if (block && context.mounted) await _block(context, ref, author);
  return true;
}

/// Confirms, then blocks [person].
Future<bool> blockFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) async {
  final name = person.label;
  final yes = await showKalloConfirm(
    context,
    title: tr('groups.moderation.blockTitle', namedArgs: {'name': name}),
    description: tr('groups.moderation.blockBody'),
    confirmLabel: tr('groups.moderation.block'),
    cancelLabel: tr('common.cancel'),
    destructive: true,
  );
  if (!yes || !context.mounted) return false;
  return _block(context, ref, person);
}

Future<bool> _block(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) async {
  final name = person.label;
  try {
    await blockCircleUser(ref, person.userId);
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.moderation.blockError', namedArgs: {'name': name}),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
  if (context.mounted) {
    showTopToast(
      context,
      tr('groups.moderation.blocked', namedArgs: {'name': name}),
    );
  }
  return true;
}

/// Confirms, then lifts the viewer's block on [person]. Not destructive: it
/// takes nothing away, and it does not restore the friendship.
Future<bool> unblockFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) async {
  final name = person.label;
  final yes = await showKalloConfirm(
    context,
    title: tr('groups.moderation.unblockTitle', namedArgs: {'name': name}),
    description: tr('groups.moderation.unblockBody'),
    confirmLabel: tr('groups.manage.unblock'),
    cancelLabel: tr('common.cancel'),
  );
  if (!yes || !context.mounted) return false;
  try {
    await unblockCircleUser(ref, person.userId);
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.moderation.unblockError', namedArgs: {'name': name}),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
  if (context.mounted) {
    showTopToast(
      context,
      tr('groups.moderation.unblocked', namedArgs: {'name': name}),
    );
  }
  return true;
}

/// Confirms, then removes [person] from the viewer's circle.
Future<bool> removeFriendFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) async {
  final name = person.label;
  final yes = await showKalloConfirm(
    context,
    title: tr('groups.moderation.removeTitle', namedArgs: {'name': name}),
    description: tr('groups.moderation.removeBody'),
    confirmLabel: tr('groups.circle.remove'),
    cancelLabel: tr('common.cancel'),
    destructive: true,
  );
  if (!yes || !context.mounted) return false;
  try {
    await removeCircleFriend(ref, person.userId);
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.circle.removeError'),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
  if (context.mounted) {
    showTopToast(
      context,
      tr('groups.moderation.removed', namedArgs: {'name': name}),
    );
  }
  return true;
}

/// Confirms, then leaves [groupId]. Clears the Circle tab's selection when it
/// was showing that group, so the tab does not open on a feed the viewer can
/// no longer read.
Future<bool> leaveGroupFlow(
  BuildContext context,
  WidgetRef ref,
  String groupId,
) async {
  final yes = await showKalloConfirm(
    context,
    title: tr('groups.feed.leaveTitle'),
    description: tr('groups.feed.leaveDescription'),
    confirmLabel: tr('groups.feed.leaveConfirm'),
    cancelLabel: tr('common.cancel'),
    destructive: true,
  );
  if (!yes || !context.mounted) return false;
  final container = ProviderScope.containerOf(context, listen: false);
  try {
    await leaveChatGroup(container, groupId);
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        tr('groups.feed.leaveError'),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
  final selected = container.read(circleSelectedViewProvider.notifier);
  if (selected.state == groupId) selected.state = null;
  return true;
}
