import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import 'add_friend_sheet.dart';
import 'create_group_empty.dart';
import 'friend_pick_row.dart';

class CreateGroupSheet extends ConsumerStatefulWidget {
  const CreateGroupSheet({super.key});

  @override
  ConsumerState<CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<CreateGroupSheet> {
  final _name = TextEditingController();
  final _search = TextEditingController();
  final _selected = <String>{};
  bool _creating = false;
  @override
  void dispose() {
    _name.dispose();
    _search.dispose();
    super.dispose();
  }
  Future<void> _submit() async {
    if (_creating || _name.text.trim().isEmpty || _selected.isEmpty) return;
    setState(() => _creating = true);
    final sheetContext = context;
    final container = ProviderScope.containerOf(sheetContext, listen: false);
    try {
      final id = await createChatGroup(
        container,
        name: _name.text.trim(),
        memberUserIds: _selected.toList(),
      );
      if (!sheetContext.mounted) return;
      container.read(circleSelectedViewProvider.notifier).state = id;
      showTopToast(sheetContext, tr('groups.createGroup.created'));
      Navigator.pop(sheetContext);
    } catch (_) {
      if (sheetContext.mounted) {
        showTopToast(
          sheetContext,
          tr('groups.createGroup.createError'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (sheetContext.mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friends =
        ref
            .watch(circleFriendsProvider)
            .valueOrNull
            ?.where((friend) => friend.isAccepted)
            .toList() ??
        const [];
    final query = _search.text.trim().toLowerCase();
    final filtered =
        friends
            .where(
              (friend) => friend.profile.label.toLowerCase().contains(query),
            )
            .toList();
    final canSubmit =
        !_creating && _name.text.trim().isNotEmpty && _selected.isNotEmpty;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .88,
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: kHairline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          Text(tr('groups.createGroup.title'), style: dashValue()),
          Text(tr('groups.createGroup.description'), style: dashMeta()),
          const SizedBox(height: NhamSpacing.sp3),
          TextField(
            controller: _name,
            maxLength: 60,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: tr('groups.createGroup.nameLabel'),
              hintText: tr('groups.createGroup.namePlaceholder'),
            ),
          ),
          Text(tr('groups.createGroup.membersLabel'), style: dashMeta()),
          const SizedBox(height: NhamSpacing.sp2),
          if (friends.isEmpty)
            CreateGroupEmpty(
              onAddFriend: () {
                Navigator.pop(context);
                showAddFriendSheet(context);
              },
            )
          else ...[
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: tr('groups.createGroup.searchPlaceholder'),
                prefixIcon: const Icon(Icons.search),
              ),
            ),
            Text(
              tr(
                'groups.createGroup.membersCount',
                namedArgs: {'count': '${_selected.length}'},
              ),
              style: dashMeta(),
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Flexible(
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
                              label: friend.profile.label,
                              initial: friend.profile.initial,
                              selected: _selected.contains(
                                friend.profile.userId,
                              ),
                              onTap:
                                  () => setState(
                                    () =>
                                        _selected.contains(
                                              friend.profile.userId,
                                            )
                                            ? _selected.remove(
                                              friend.profile.userId,
                                            )
                                            : _selected.add(
                                              friend.profile.userId,
                                            ),
                                  ),
                            ),
                        ],
                      ),
            ),
          ],
          const SizedBox(height: NhamSpacing.sp3),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: canSubmit ? _submit : null,
              child: Text(
                tr(
                  _creating
                      ? 'groups.createGroup.creating'
                      : 'groups.createGroup.submit',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
