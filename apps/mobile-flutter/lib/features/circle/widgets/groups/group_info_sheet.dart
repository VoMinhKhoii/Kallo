import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/http/api_client.dart';
import '../../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/chat_group_providers.dart';
import '../../data/feed_providers.dart';
import 'group_add_people.dart';
import '../states/group_info_skeleton.dart';
import 'group_members_list.dart';

class GroupInfoSheet extends ConsumerStatefulWidget {
  const GroupInfoSheet({required this.groupId, super.key});
  final String groupId;
  @override
  ConsumerState<GroupInfoSheet> createState() => _GroupInfoSheetState();
}

class _GroupInfoSheetState extends ConsumerState<GroupInfoSheet> {
  bool _editingName = false, _renaming = false;
  final _name = TextEditingController();
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _rename() async {
    if (_renaming || _name.text.trim().isEmpty) return;
    setState(() => _renaming = true);
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      await renameChatGroup(
        container,
        groupId: widget.groupId,
        name: _name.text.trim(),
      );
      if (mounted) setState(() => _editingName = false);
    } catch (_) {
      if (!mounted) return;
      showTopToast(
        context,
        tr('groups.info.renameError'),
        variant: TopToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _renaming = false);
    }
  }

  Future<void> _leave() async {
    final sheetContext = context;
    // This one KEEPS its verb: "Rời nhóm" above "Huỷ" is two different words
    // for two different things, so there is nothing to disambiguate. Only the
    // confirms whose affirmative collides with the cancel go to "Đồng ý".
    final yes = await showKalloConfirm(
      sheetContext,
      title: tr('groups.feed.leaveTitle'),
      description: tr('groups.feed.leaveDescription'),
      confirmLabel: tr('groups.feed.leaveConfirm'),
      destructive: true,
    );
    if (!yes || !sheetContext.mounted) return;
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
  Widget build(BuildContext context) => KalloSheetSurface(
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * .9,
    ),
    child: ref
        .watch(chatGroupDetailProvider(widget.groupId))
        .when(
          loading: () => const GroupDetailSkeleton(),
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
              (group) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  KalloSheetHeader(
                    titleWidget: _editingName
                        ? Row(
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
                                onPressed: _renaming ? null : _rename,
                                tooltip: tr('groups.info.renameSave'),
                                icon: const Icon(LucideIcons.check300),
                              ),
                            ],
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Flexible(
                                child: Text(
                                  group.name ?? '',
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: dashValue().copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              if (group.myRole == 'owner')
                                IconButton(
                                  tooltip: tr('groups.info.renameLabel'),
                                  onPressed: () {
                                    _name.text = group.name ?? '';
                                    setState(() => _editingName = true);
                                  },
                                  icon: const Icon(
                                    LucideIcons.pencil300,
                                    size: 16,
                                  ),
                                ),
                            ],
                          ),
                    subtitle: tr(
                      'groups.info.memberCount',
                      namedArgs: {'count': '${group.members.length}'},
                    ),
                  ),
                  Flexible(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(
                        KalloSpacing.sp5,
                        KalloSpacing.sp2,
                        KalloSpacing.sp5,
                        KalloSpacing.sp5,
                      ),
                      children: [
                        Text(
                          tr('groups.info.membersHeading'),
                          style: dashMeta(),
                        ),
                        GroupMembersList(group: group),
                        const SizedBox(height: KalloSpacing.sp4),
                        Text(tr('groups.info.addPeople'), style: dashMeta()),
                        const SizedBox(height: KalloSpacing.sp2),
                        GroupAddPeople(group: group),
                        const Divider(height: KalloSpacing.sp6, color: kHairline),
                        TextButton.icon(
                          onPressed: _leave,
                          icon: const Icon(LucideIcons.logOut300, size: 16),
                          label: Text(tr('groups.feed.leave')),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
        ),
  );
}
