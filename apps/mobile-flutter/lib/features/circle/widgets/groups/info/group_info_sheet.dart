import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../services/auth/session_provider.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../shared/widgets/sheet/sheet_page_swap.dart';
import '../../../../../shared/widgets/toast/top_toast.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/chat_group_providers.dart';
import '../../../logic/group_permissions.dart';
import '../../../logic/group_member_flows.dart';
import '../../../logic/moderation_flows.dart';
import '../../states/group_info_skeleton.dart';
import 'group_add_page.dart';
import 'group_info_page.dart';
import 'group_rename_page.dart';

enum _Level { info, add, rename }

/// The group sheet: info first, with "Add members" and "Rename group" as
/// second levels that slide in inside the same sheet ([SheetPageSwap]) —
/// one surface, one grabber, one way out.
///
/// The surface is the CANVAS colour, not white: its body is white grouped
/// cards, which separate from the canvas the way they do on a page (the scan
/// result's precedent in [KalloSheetSurface.color]).
class GroupInfoSheet extends ConsumerStatefulWidget {
  const GroupInfoSheet({required this.groupId, super.key});
  final String groupId;
  @override
  ConsumerState<GroupInfoSheet> createState() => _GroupInfoSheetState();
}

class _GroupInfoSheetState extends ConsumerState<GroupInfoSheet> {
  _Level _level = _Level.info;
  bool _busy = false;
  final _name = TextEditingController();
  final _search = TextEditingController();
  final _picked = <String>{};

  /// Removed this session. A swiped row leaves the tree the moment it is
  /// dismissed; the refetch that drops it from the detail lands later, and a
  /// dismissed [Dismissible] still in the tree is an assertion.
  final _removed = <String>{};

  @override
  void dispose() {
    _name.dispose();
    _search.dispose();
    super.dispose();
  }

  ProviderContainer get _container =>
      ProviderScope.containerOf(context, listen: false);

  void _go(_Level level) => setState(() {
    _level = level;
    if (level == _Level.info) {
      _picked.clear();
      _search.clear();
    }
  });

  Future<void> _run(Future<void> Function() action, String errorKey) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) _go(_Level.info);
    } catch (_) {
      if (mounted) {
        showTopToast(context, tr(errorKey), variant: TopToastVariant.error);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rename() => _run(
    () => renameChatGroup(
      _container,
      groupId: widget.groupId,
      name: _name.text.trim(),
    ),
    'groups.info.renameError',
  );

  Future<void> _add() => _run(() async {
    await addGroupMembers(
      _container,
      groupId: widget.groupId,
      memberUserIds: _picked.toList(),
    );
    if (mounted) showTopToast(context, tr('groups.info.added'));
  }, 'groups.info.addError');

  Future<bool> _remove(ChatGroupMember member) =>
      removeGroupMemberFlow(context, groupId: widget.groupId, member: member);

  Future<void> _leave() async {
    if (await leaveGroupFlow(context, ref, widget.groupId) && mounted) {
      Navigator.pop(context);
    }
  }

  ChatGroupDetail _withoutRemoved(ChatGroupDetail group) =>
      _removed.isEmpty
          ? group
          : ChatGroupDetail(
            id: group.id,
            kind: group.kind,
            name: group.name,
            myRole: group.myRole,
            members: [
              for (final m in group.members)
                if (!_removed.contains(m.userId)) m,
            ],
          );

  Widget _page(ChatGroupDetail group) => switch (_level) {
    _Level.info => GroupInfoPage(
      group: group,
      selfId: ref.watch(currentSessionProvider)?.user.id,
      onAdd: () => _go(_Level.add),
      onRename: () {
        _name.text = group.name ?? '';
        _go(_Level.rename);
      },
      onRemove: _remove,
      onRemoved: (id) => setState(() => _removed.add(id)),
      onLeave: groupActionsFor(group).leave ? _leave : null,
    ),
    _Level.add => GroupAddPage(
      group: group,
      search: _search,
      selected: _picked,
      busy: _busy,
      onToggle:
          (id) => setState(
            () => _picked.contains(id) ? _picked.remove(id) : _picked.add(id),
          ),
      onBack: () => _go(_Level.info),
      onAdd: _add,
    ),
    _Level.rename => GroupRenamePage(
      controller: _name,
      busy: _busy,
      onBack: () => _go(_Level.info),
      onSave: _rename,
    ),
  };

  @override
  Widget build(BuildContext context) => KalloSheetSurface(
    color: kPage,
    constraints: BoxConstraints(
      // Off the height the keyboard LEAVES — `KalloSheetSurface` lifts the
      // sheet clear of it, and the rename and search fields both raise one.
      maxHeight:
          (MediaQuery.sizeOf(context).height -
              MediaQuery.viewInsetsOf(context).bottom) *
          .9,
    ),
    child: ref
        .watch(chatGroupDetailProvider(widget.groupId))
        .when(
          loading: () => const GroupDetailSkeleton(),
          error:
              (_, __) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const KalloSheetHeader(),
                  CupertinoButton(
                    onPressed:
                        () => ref.invalidate(
                          chatGroupDetailProvider(widget.groupId),
                        ),
                    child: Text(tr('groups.switcher.retry')),
                  ),
                  const SizedBox(height: KalloSpacing.sp6),
                ],
              ),
          data:
              (group) => SheetPageSwap(
                isSecondLevel: _level != _Level.info,
                child: KeyedSubtree(
                  key: ValueKey(_level),
                  child: _page(_withoutRemoved(group)),
                ),
              ),
        ),
  );
}
