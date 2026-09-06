import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/chat_group.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../data/chat_group_providers.dart';
import '../../../../theme/kallo_theme.dart';

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
                icon: const Icon(LucideIcons.x300, size: KalloIcons.tertiary),
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
    // "Xoá {name}?" — "Xoá" against "Giữ lại": the member goes, or stays.
    final confirmed = await showKalloConfirm(
      context,
      title: tr('groups.info.removeTitle', namedArgs: {'name': member.label}),
      description: tr('groups.info.removeDescription'),
      confirmLabel: tr('common.actions.remove'),
      cancelLabel: tr('common.actions.keep'),
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
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
