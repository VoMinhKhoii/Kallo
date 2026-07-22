import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/chat_group.dart';
import '../../../models/circle.dart';
import '../../../shared/widgets/skeleton.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import 'friend_pick_row.dart';

class GroupAddPeople extends ConsumerStatefulWidget {
  const GroupAddPeople({required this.group, super.key});
  final ChatGroupDetail group;
  @override
  ConsumerState<GroupAddPeople> createState() => _GroupAddPeopleState();
}

class _GroupAddPeopleState extends ConsumerState<GroupAddPeople> {
  final _search = TextEditingController();
  final _selected = <String>{};
  bool _adding = false;
  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    if (_selected.isEmpty || _adding) return;
    setState(() => _adding = true);
    final sheetContext = context;
    final container = ProviderScope.containerOf(sheetContext, listen: false);
    try {
      await addGroupMembers(
        container,
        groupId: widget.group.id,
        memberUserIds: _selected.toList(),
      );
      if (!sheetContext.mounted) return;
      setState(() {
        _selected.clear();
        _search.clear();
      });
      showTopToast(sheetContext, tr('groups.info.added'));
    } catch (_) {
      if (sheetContext.mounted) {
        showTopToast(
          sheetContext,
          tr('groups.info.addError'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (sheetContext.mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final memberIds =
        widget.group.members.map((member) => member.userId).toSet();
    return ref
        .watch(circleFriendsProvider)
        .when(
          loading: () => FriendListSkeleton(
            semanticsLabel: tr('common.loading'),
          ),
          error:
              (_, __) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(tr('groups.friendsLoadError'), style: dashMeta()),
                    TextButton(
                      onPressed: () => ref.invalidate(circleFriendsProvider),
                      child: Text(tr('groups.switcher.retry')),
                    ),
                  ],
                ),
              ),
          data:
              (friends) => _content(
                friends
                    .where(
                      (friend) =>
                          friend.isAccepted &&
                          !memberIds.contains(friend.profile.userId),
                    )
                    .toList(),
              ),
        );
  }

  Widget _content(List<CircleMember> candidates) {
    if (candidates.isEmpty) {
      return Text(tr('groups.info.everyoneIn'), style: dashMeta());
    }
    final query = _search.text.trim().toLowerCase();
    final filtered = candidates.where(
      (friend) => friend.profile.label.toLowerCase().contains(query),
    );
    return Column(
      children: [
        TextField(
          controller: _search,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: tr('groups.info.searchPlaceholder'),
            prefixIcon: const Icon(Icons.search),
          ),
        ),
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(tr('groups.info.noMatches'), style: dashMeta()),
          )
        else
          for (final friend in filtered)
            FriendPickRow(
              profile: friend.profile,
              selected: _selected.contains(friend.profile.userId),
              onTap:
                  () => setState(
                    () =>
                        _selected.contains(friend.profile.userId)
                            ? _selected.remove(friend.profile.userId)
                            : _selected.add(friend.profile.userId),
                  ),
            ),
        if (_selected.isNotEmpty)
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _adding ? null : _add,
              child: Text('${tr('groups.info.addCta')} · ${_selected.length}'),
            ),
          ),
      ],
    );
  }
}
