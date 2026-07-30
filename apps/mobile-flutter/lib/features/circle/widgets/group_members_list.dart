import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/chat_group.dart';
import '../../../shared/widgets/profile_avatar.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../data/chat_group_providers.dart';

class GroupMembersList extends ConsumerWidget {
  const GroupMembersList({required this.group, super.key});
  final ChatGroupDetail group;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Column(
    children: [for (final member in group.members) _row(context, ref, member)],
  );

  Widget _row(BuildContext context, WidgetRef ref, ChatGroupMember member) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            ProfileAvatarDisc(profile: member, size: 32),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                member.label,
                overflow: TextOverflow.ellipsis,
                style: dashBody(),
              ),
            ),
            if (member.role == 'owner')
              Text(tr('groups.info.owner'), style: dashMeta())
            else if (group.myRole == 'owner')
              IconButton(
                tooltip: tr(
                  'groups.info.removeLabel',
                  namedArgs: {'name': member.label},
                ),
                icon: const Icon(LucideIcons.x300, size: 16),
                onPressed: () => _confirmRemove(context, ref, member),
              ),
          ],
        ),
      );

  Future<void> _confirmRemove(
    BuildContext context,
    WidgetRef ref,
    ChatGroupMember member,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: Text(
              tr('groups.info.removeTitle', namedArgs: {'name': member.label}),
            ),
            content: Text(tr('groups.info.removeDescription')),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(tr('groups.feed.cancel')),
              ),
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(tr('groups.info.removeConfirm')),
              ),
            ],
          ),
    );
    if (confirmed != true || !context.mounted) return;
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      await removeGroupMember(
        container,
        groupId: group.id,
        userId: member.userId,
      );
    } catch (_) {
      if (context.mounted) {
        showTopToast(
          context,
          tr('groups.info.removeError'),
          variant: TopToastVariant.error,
        );
      }
    }
  }
}
