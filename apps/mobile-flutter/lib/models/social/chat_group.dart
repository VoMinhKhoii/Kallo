/// DTOs for chat-group list and detail responses.
///
/// Contract source of truth: `lib/actions/chat-groups/types.ts`.
library;

import 'circle.dart';

/// One direct or named-group row in the chat-group list.
class ChatGroupIdentity {
  const ChatGroupIdentity({
    required this.id,
    required this.kind,
    required this.title,
    required this.updatedAt,
    required this.unread,
    this.avatarSeed,
    this.lastMessagePreview,
    this.lastMessageAt,
    this.lastMealSharedAt,
  });

  final String id;

  /// `'direct' | 'group'`.
  final String kind;
  final String title;
  final String? avatarSeed;
  final String updatedAt;
  final String? lastMessagePreview;
  final String? lastMessageAt;
  final bool unread;
  final String? lastMealSharedAt;

  factory ChatGroupIdentity.fromJson(Map<String, dynamic> json) =>
      ChatGroupIdentity(
        id: json['id'] as String,
        kind: json['kind'] as String,
        title: json['title'] as String,
        avatarSeed: json['avatarSeed'] as String?,
        updatedAt: json['updatedAt'] as String,
        lastMessagePreview: json['lastMessagePreview'] as String?,
        lastMessageAt: json['lastMessageAt'] as String?,
        unread: json['unread'] as bool? ?? false,
        lastMealSharedAt: json['lastMealSharedAt'] as String?,
      );
}

/// A flat public identity plus its role within a chat group.
class ChatGroupMember extends CircleProfile {
  const ChatGroupMember({
    required super.userId,
    required super.handle,
    required this.role,
    super.displayName,
    super.avatarSeed,
    super.avatarUrl,
  });

  final String role;

  factory ChatGroupMember.fromJson(Map<String, dynamic> json) =>
      ChatGroupMember(
        userId: json['userId'] as String,
        handle: json['handle'] as String? ?? '',
        displayName: json['displayName'] as String?,
        avatarSeed: json['avatarSeed'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        role: json['role'] as String,
      );
}

/// Full chat-group membership details for the requesting actor.
class ChatGroupDetail {
  const ChatGroupDetail({
    required this.id,
    required this.kind,
    required this.name,
    required this.members,
    required this.myRole,
  });

  final String id;

  /// `'direct' | 'group'`.
  final String kind;
  final String? name;
  final List<ChatGroupMember> members;

  /// `'owner' | 'member'`; gates owner-only controls in later work packages.
  final String myRole;

  factory ChatGroupDetail.fromJson(Map<String, dynamic> json) =>
      ChatGroupDetail(
        id: json['id'] as String,
        kind: json['kind'] as String,
        name: json['name'] as String?,
        members: ((json['members'] as List<dynamic>?) ?? const [])
            .map(
              (member) =>
                  ChatGroupMember.fromJson(member as Map<String, dynamic>),
            )
            .toList(),
        myRole: json['myRole'] as String,
      );
}
