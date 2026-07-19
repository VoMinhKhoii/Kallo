import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import 'add_friend_sheet.dart';
import 'create_group_sheet.dart';

Future<void> showCreateGroupSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CreateGroupSheet(),
    );

class CircleAddMenu extends StatelessWidget {
  const CircleAddMenu({super.key});

  @override
  Widget build(BuildContext context) => PopupMenuButton<_AddAction>(
    tooltip: tr('groups.page.addFriend'),
    color: Colors.white,
    surfaceTintColor: Colors.transparent,
    onSelected: (action) {
      if (action == _AddAction.group) {
        showCreateGroupSheet(context);
      } else {
        showAddFriendSheet(context);
      }
    },
    itemBuilder:
        (_) => [
          _item(
            _AddAction.group,
            LucideIcons.users,
            tr('groups.page.createGroup'),
          ),
          _item(
            _AddAction.friend,
            LucideIcons.userPlus,
            tr('groups.page.addFriend'),
          ),
        ],
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: NhamColors.btn,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.userPlus, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            tr('groups.page.addFriend'),
            style: NhamTextStyles.sansMedium(
              fontSize: 12,
            ).copyWith(color: Colors.white),
          ),
          const SizedBox(width: 5),
          const Icon(LucideIcons.chevronDown, size: 14, color: Colors.white),
        ],
      ),
    ),
  );

  PopupMenuItem<_AddAction> _item(
    _AddAction value,
    IconData icon,
    String label,
  ) => PopupMenuItem(
    value: value,
    child: Row(
      children: [Icon(icon, size: 17), const SizedBox(width: 10), Text(label)],
    ),
  );
}

enum _AddAction { group, friend }
