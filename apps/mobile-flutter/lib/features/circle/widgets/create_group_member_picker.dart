import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/skeleton.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import 'create_group_empty.dart';
import 'friend_pick_row.dart';

class CreateGroupMemberPicker extends StatelessWidget {
  const CreateGroupMemberPicker({
    required this.friends,
    required this.searchController,
    required this.selected,
    required this.onChanged,
    required this.onRetry,
    required this.onAddFriend,
    super.key,
  });

  final AsyncValue<List<CircleMember>> friends;
  final TextEditingController searchController;
  final Set<String> selected;
  final VoidCallback onChanged;
  final VoidCallback onRetry;
  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) => friends.when(
    loading: () => Flexible(
      child: Align(
        alignment: Alignment.topCenter,
        child: FriendListSkeleton(semanticsLabel: tr('common.loading')),
      ),
    ),
    error:
        (_, __) => Flexible(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(tr('groups.friendsLoadError'), style: dashMeta()),
                TextButton(
                  onPressed: onRetry,
                  child: Text(tr('groups.switcher.retry')),
                ),
              ],
            ),
          ),
        ),
    data: (members) {
      final accepted = members.where((friend) => friend.isAccepted).toList();
      if (accepted.isEmpty) return CreateGroupEmpty(onAddFriend: onAddFriend);
      final query = searchController.text.trim().toLowerCase();
      final filtered = accepted.where(
        (friend) => friend.profile.label.toLowerCase().contains(query),
      );
      return Flexible(
        child: Column(
          children: [
            TextField(
              controller: searchController,
              onChanged: (_) => onChanged(),
              decoration: InputDecoration(
                hintText: tr('groups.createGroup.searchPlaceholder'),
                prefixIcon: const Icon(Icons.search),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                tr(
                  'groups.createGroup.membersCount',
                  namedArgs: {'count': '${selected.length}'},
                ),
                style: dashMeta(),
              ),
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Expanded(
              child:
                  filtered.isEmpty
                      ? Center(
                        child: Text(
                          tr('groups.createGroup.noMatches'),
                          style: dashMeta(),
                        ),
                      )
                      : ListView(
                        children: [
                          for (final friend in filtered)
                            FriendPickRow(
                              profile: friend.profile,
                              selected: selected.contains(
                                friend.profile.userId,
                              ),
                              onTap: () {
                                final id = friend.profile.userId;
                                selected.contains(id)
                                    ? selected.remove(id)
                                    : selected.add(id);
                                onChanged();
                              },
                            ),
                        ],
                      ),
            ),
          ],
        ),
      );
    },
  );
}
