import '../../../models/social/chat_group.dart';

/// Which of a group's `⋯` actions the viewer may take — the server's own
/// rules, so the menu never offers something guaranteed to fail:
///
/// - **Report** resolves a group to its creator (`report-targets.ts`) and a
///   self-report is rejected (`reports.ts`), so the owner cannot report it.
/// - **Leave** is refused to an owner while anyone else is still in the group
///   (`membership.ts`, `leaveChatGroup`): ownership cannot be handed over yet.
///
/// A [detail] that has not loaded (or failed) offers both — the server still
/// guards them, and hiding a real option on a slow request would be worse.
({bool report, bool leave}) groupActionsFor(ChatGroupDetail? detail) {
  if (detail == null) return (report: true, leave: true);
  final owner = detail.myRole == 'owner';
  // Role-based rather than a count, so it holds whether or not the viewer's
  // own row is in [ChatGroupDetail.members]: a group has one owner.
  final othersRemain = detail.members.any((m) => m.role != 'owner');
  return (report: !owner, leave: !(owner && othersRemain));
}
