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
/// it is a separate choice on its own menu. [onBlocked] runs once that block
/// lands, for a caller showing the person (their row is now stale).
Future<bool> reportFlow(
  BuildContext context,
  WidgetRef ref, {
  required ReportTargetKind kind,
  required String targetId,
  CircleProfile? author,
  VoidCallback? onBlocked,
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

  final sent = await _run(
    context,
    action:
        () => reportCircleContent(
          ref,
          kind: kind,
          targetId: targetId,
          reason: reason,
        ),
    // With no author to offer a block on, the toast IS the thank-you.
    done: author == null ? tr('groups.moderation.reportSentBody') : null,
    failed: tr('groups.moderation.reportError'),
  );
  if (!sent || author == null || !context.mounted) return sent;

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
  if (block && context.mounted) {
    final blocked = await _block(context, ref, author, ask: false);
    if (blocked) onBlocked?.call();
  }
  return true;
}

/// Confirms, then blocks [person].
Future<bool> blockFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) => _block(context, ref, person, ask: true);

/// Blocks [person], asking first unless [ask] is false — for a caller whose
/// own button already was the confirmation (the report thank-you's "Block
/// {name}").
Future<bool> _block(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person, {
  required bool ask,
}) {
  final name = {'name': person.label};
  return _run(
    context,
    confirm:
        ask
            ? (
              title: tr('groups.moderation.blockTitle', namedArgs: name),
              body: tr('groups.moderation.blockBody'),
              label: tr('groups.moderation.block'),
              destructive: true,
            )
            : null,
    action: () => blockCircleUser(ref, person.userId),
    done: tr('groups.moderation.blocked', namedArgs: name),
    failed: tr('groups.moderation.blockError', namedArgs: name),
  );
}

/// Confirms, then lifts the viewer's block on [person]. Not destructive: it
/// takes nothing away, and it does not restore the friendship.
Future<bool> unblockFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) => _run(
  context,
  confirm: (
    title: tr(
      'groups.moderation.unblockTitle',
      namedArgs: {'name': person.label},
    ),
    body: tr('groups.moderation.unblockBody'),
    label: tr('groups.manage.unblock'),
    destructive: false,
  ),
  action: () => unblockCircleUser(ref, person.userId),
  done: tr('groups.moderation.unblocked', namedArgs: {'name': person.label}),
  failed: tr(
    'groups.moderation.unblockError',
    namedArgs: {'name': person.label},
  ),
);

/// Confirms, then removes [person] from the viewer's circle.
Future<bool> removeFriendFlow(
  BuildContext context,
  WidgetRef ref,
  CircleProfile person,
) => _run(
  context,
  confirm: (
    title: tr(
      'groups.moderation.removeTitle',
      namedArgs: {'name': person.label},
    ),
    body: tr('groups.moderation.removeBody'),
    label: tr('groups.circle.remove'),
    destructive: true,
  ),
  action: () => removeCircleFriend(ref, person.userId),
  done: tr('groups.moderation.removed', namedArgs: {'name': person.label}),
  failed: tr('groups.circle.removeError'),
);

/// Confirms, then leaves [groupId]. Clears the Circle tab's selection when it
/// was showing that group, so the tab does not open on a feed the viewer can
/// no longer read. No success toast: the row leaving the list says it.
Future<bool> leaveGroupFlow(
  BuildContext context,
  WidgetRef ref,
  String groupId,
) {
  final container = ProviderScope.containerOf(context, listen: false);
  return _run(
    context,
    confirm: (
      title: tr('groups.feed.leaveTitle'),
      body: tr('groups.feed.leaveDescription'),
      label: tr('groups.feed.leaveConfirm'),
      destructive: true,
    ),
    action: () async {
      await leaveChatGroup(container, groupId);
      final selected = container.read(circleSelectedViewProvider.notifier);
      if (selected.state == groupId) selected.state = null;
    },
    failed: tr('groups.feed.leaveError'),
  );
}

/// What a flow asks before it acts.
typedef _Confirm =
    ({String title, String body, String label, bool destructive});

/// The one shape every flow above shares: ask (when [confirm] is given), run
/// [action], then answer with a toast — [done] on success (none when null),
/// [failed] on any error. Never rethrows; returns whether [action] ran and
/// succeeded.
Future<bool> _run(
  BuildContext context, {
  _Confirm? confirm,
  required Future<void> Function() action,
  String? done,
  required String failed,
}) async {
  if (confirm != null) {
    final yes = await showKalloConfirm(
      context,
      title: confirm.title,
      description: confirm.body,
      confirmLabel: confirm.label,
      cancelLabel: tr('common.cancel'),
      destructive: confirm.destructive,
    );
    if (!yes || !context.mounted) return false;
  }
  try {
    await action();
  } catch (_) {
    if (context.mounted) {
      showTopToast(context, failed, variant: TopToastVariant.error);
    }
    return false;
  }
  if (done != null && context.mounted) showTopToast(context, done);
  return true;
}
