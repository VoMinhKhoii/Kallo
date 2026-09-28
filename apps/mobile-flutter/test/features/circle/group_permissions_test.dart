import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/logic/group_permissions.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';

/// The group `⋯` mirrors the server: no self-report for the owner (a group
/// report resolves to its creator), and no leaving for an owner while anyone
/// else is still in the group.
void main() {
  ChatGroupDetail detail(String myRole, List<String> otherRoles) =>
      ChatGroupDetail(
        id: 'g1',
        kind: 'group',
        name: 'Team',
        myRole: myRole,
        members: [
          ChatGroupMember(userId: 'me', handle: 'me', role: myRole),
          for (final (i, role) in otherRoles.indexed)
            ChatGroupMember(userId: 'u$i', handle: 'u$i', role: role),
        ],
      );

  test('a member may report and leave', () {
    expect(groupActionsFor(detail('member', ['owner'])), (
      report: true,
      leave: true,
    ));
  });

  test('an owner with members may do neither', () {
    expect(groupActionsFor(detail('owner', ['member'])), (
      report: false,
      leave: false,
    ));
  });

  test('an owner alone may leave but not report', () {
    expect(groupActionsFor(detail('owner', [])), (report: false, leave: true));
  });
}
