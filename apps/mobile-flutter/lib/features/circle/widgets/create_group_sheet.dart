import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/nham_sheet.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import 'add_friend_sheet.dart';
import 'create_group_member_picker.dart';

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
    final canSubmit =
        !_creating && _name.text.trim().isNotEmpty && _selected.isNotEmpty;
    return NhamSheetSurface(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .88,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NhamSheetHeader(
            title: tr('groups.createGroup.title'),
            subtitle: tr('groups.createGroup.description'),
          ),
          Flexible(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                0,
                20,
                MediaQuery.viewInsetsOf(context).bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _name,
                    maxLength: 60,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: tr('groups.createGroup.nameLabel'),
                      hintText: tr('groups.createGroup.namePlaceholder'),
                    ),
                  ),
                  Text(
                    tr('groups.createGroup.membersLabel'),
                    style: dashMeta(),
                  ),
                  const SizedBox(height: NhamSpacing.sp2),
                  CreateGroupMemberPicker(
                    friends: ref.watch(circleFriendsProvider),
                    searchController: _search,
                    selected: _selected,
                    onChanged: () => setState(() {}),
                    onRetry: () => ref.invalidate(circleFriendsProvider),
                    onAddFriend: () {
                      Navigator.pop(context);
                      showAddFriendSheet(context);
                    },
                  ),
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
            ),
          ),
        ],
      ),
    );
  }
}
