import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/api_client.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/chat_group_providers.dart';
import '../data/feed_providers.dart';
import 'group_add_people.dart';
import 'group_members_list.dart';

class GroupInfoSheet extends ConsumerStatefulWidget {
  const GroupInfoSheet({required this.groupId, super.key});
  final String groupId;
  @override
  ConsumerState<GroupInfoSheet> createState() => _GroupInfoSheetState();
}

class _GroupInfoSheetState extends ConsumerState<GroupInfoSheet> {
  bool _renaming = false;
  final _name = TextEditingController();
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _rename() async {
    if (_name.text.trim().isEmpty) return;
    final sheetContext = context;
    final container = ProviderScope.containerOf(sheetContext, listen: false);
    try {
      await renameChatGroup(
        container,
        groupId: widget.groupId,
        name: _name.text.trim(),
      );
      if (sheetContext.mounted) setState(() => _renaming = false);
    } catch (_) {
      if (sheetContext.mounted) {
        showTopToast(
          sheetContext,
          tr('groups.info.renameError'),
          variant: TopToastVariant.error,
        );
      }
    }
  }

  Future<void> _leave() async {
    final sheetContext = context;
    final yes = await showDialog<bool>(
      context: sheetContext,
      builder:
          (dialogContext) => AlertDialog(
            title: Text(tr('groups.feed.leaveTitle')),
            content: Text(tr('groups.feed.leaveDescription')),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(tr('groups.feed.cancel')),
              ),
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(tr('groups.feed.leaveConfirm')),
              ),
            ],
          ),
    );
    if (yes != true || !sheetContext.mounted) return;
    final container = ProviderScope.containerOf(sheetContext, listen: false);
    try {
      await leaveChatGroup(container, widget.groupId);
      if (!sheetContext.mounted) return;
      container.read(circleSelectedViewProvider.notifier).state = null;
      Navigator.pop(sheetContext);
    } catch (error) {
      if (!sheetContext.mounted) return;
      final message =
          error is ApiError ? error.message : tr('groups.feed.leaveError');
      showTopToast(sheetContext, message, variant: TopToastVariant.error);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * .9,
    ),
    decoration: const BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    child: ref
        .watch(chatGroupDetailProvider(widget.groupId))
        .when(
          loading:
              () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(),
                ),
              ),
          error:
              (_, __) => Center(
                child: TextButton(
                  onPressed:
                      () => ref.invalidate(
                        chatGroupDetailProvider(widget.groupId),
                      ),
                  child: Text(tr('groups.switcher.retry')),
                ),
              ),
          data:
              (group) => ListView(
                padding: const EdgeInsets.all(NhamSpacing.sp5),
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
                  const SizedBox(height: NhamSpacing.sp4),
                  if (_renaming)
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _name,
                            maxLength: 60,
                            decoration: InputDecoration(
                              labelText: tr('groups.info.renameLabel'),
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: _rename,
                          tooltip: tr('groups.info.renameSave'),
                          icon: const Icon(LucideIcons.check),
                        ),
                      ],
                    )
                  else
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            group.name ?? '',
                            textAlign: TextAlign.center,
                            style: dashValue(),
                          ),
                        ),
                        if (group.myRole == 'owner')
                          IconButton(
                            tooltip: tr('groups.info.renameLabel'),
                            onPressed: () {
                              _name.text = group.name ?? '';
                              setState(() => _renaming = true);
                            },
                            icon: const Icon(LucideIcons.pencil, size: 16),
                          ),
                      ],
                    ),
                  Center(
                    child: Text(
                      tr(
                        'groups.info.memberCount',
                        namedArgs: {'count': '${group.members.length}'},
                      ),
                      style: dashMeta(),
                    ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  Text(tr('groups.info.membersHeading'), style: dashMeta()),
                  GroupMembersList(group: group),
                  const SizedBox(height: NhamSpacing.sp4),
                  Text(tr('groups.info.addPeople'), style: dashMeta()),
                  const SizedBox(height: NhamSpacing.sp2),
                  GroupAddPeople(group: group),
                  const Divider(height: NhamSpacing.sp6, color: kHairline),
                  TextButton.icon(
                    onPressed: _leave,
                    icon: const Icon(LucideIcons.logOut, size: 16),
                    label: Text(tr('groups.feed.leave')),
                  ),
                ],
              ),
        ),
  );
}
