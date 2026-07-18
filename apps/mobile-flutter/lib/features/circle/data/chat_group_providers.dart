/// Chat-group list/detail providers and membership mutations.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../models/chat_group.dart';
import '../../dashboard/data/dashboard_providers.dart'
    show localTimezoneOffsetMinutes;

const Duration _groupRequestTimeout = Duration(seconds: 15);

final chatGroupsProvider = FutureProvider.autoDispose<List<ChatGroupIdentity>>((
  ref,
) async {
  final api = ref.watch(apiClientProvider);
  final timezoneOffset = localTimezoneOffsetMinutes();
  return runWithRetry(() async {
    final json = await api
        .get<Map<String, dynamic>>(
          '/api/v1/chat-groups?timezoneOffset=$timezoneOffset',
        )
        .timeout(_groupRequestTimeout);
    return ((json['groups'] as List<dynamic>?) ?? const [])
        .map(
          (group) => ChatGroupIdentity.fromJson(group as Map<String, dynamic>),
        )
        .toList(growable: false);
  });
});

final chatGroupDetailProvider = FutureProvider.autoDispose
    .family<ChatGroupDetail, String>((ref, groupId) async {
      final api = ref.watch(apiClientProvider);
      final id = Uri.encodeComponent(groupId);
      return runWithRetry(() async {
        final json = await api
            .get<Map<String, dynamic>>('/api/v1/chat-groups/$id')
            .timeout(_groupRequestTimeout);
        return ChatGroupDetail.fromJson(json['group'] as Map<String, dynamic>);
      });
    });

Future<String> createChatGroup(
  ProviderContainer container, {
  required String name,
  required List<String> memberUserIds,
}) async {
  final api = container.read(apiClientProvider);
  final json = await api
      .post<Map<String, dynamic>>('/api/v1/chat-groups', {
        'name': name,
        'memberUserIds': memberUserIds,
      })
      .timeout(_groupRequestTimeout);
  container.invalidate(chatGroupsProvider);
  final group = json['group'] as Map<String, dynamic>;
  return group['id'] as String;
}

Future<void> renameChatGroup(
  ProviderContainer container, {
  required String groupId,
  required String name,
}) async {
  final api = container.read(apiClientProvider);
  final id = Uri.encodeComponent(groupId);
  await api
      .patch<Map<String, dynamic>>('/api/v1/chat-groups/$id', {'name': name})
      .timeout(_groupRequestTimeout);
  container.invalidate(chatGroupDetailProvider(groupId));
  container.invalidate(chatGroupsProvider);
}

Future<void> addGroupMembers(
  ProviderContainer container, {
  required String groupId,
  required List<String> memberUserIds,
}) async {
  final api = container.read(apiClientProvider);
  final id = Uri.encodeComponent(groupId);
  await api
      .post<Map<String, dynamic>>('/api/v1/chat-groups/$id/members', {
        'memberUserIds': memberUserIds,
      })
      .timeout(_groupRequestTimeout);
  container.invalidate(chatGroupDetailProvider(groupId));
  container.invalidate(chatGroupsProvider);
}

Future<void> removeGroupMember(
  ProviderContainer container, {
  required String groupId,
  required String userId,
}) async {
  final api = container.read(apiClientProvider);
  final id = Uri.encodeComponent(groupId);
  final memberId = Uri.encodeComponent(userId);
  await api
      .delete<Map<String, dynamic>>('/api/v1/chat-groups/$id/members/$memberId')
      .timeout(_groupRequestTimeout);
  container.invalidate(chatGroupDetailProvider(groupId));
  container.invalidate(chatGroupsProvider);
}

Future<void> leaveChatGroup(ProviderContainer container, String groupId) async {
  final api = container.read(apiClientProvider);
  final id = Uri.encodeComponent(groupId);
  await api
      .delete<Map<String, dynamic>>('/api/v1/chat-groups/$id/leave')
      .timeout(_groupRequestTimeout);
  container.invalidate(chatGroupsProvider);
  container.invalidate(chatGroupDetailProvider(groupId));
}
