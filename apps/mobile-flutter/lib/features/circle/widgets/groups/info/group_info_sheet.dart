import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../services/auth/session_provider.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../shared/widgets/sheet/sheet_page_swap.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../data/chat_group_providers.dart';
import '../../../logic/group_permissions.dart';
import '../../../logic/group_flows.dart';
import '../../../logic/moderation_flows.dart';
import '../../states/group_info_error.dart';
import '../../states/group_info_skeleton.dart';
import 'group_add_page.dart';
import 'group_info_page.dart';
import 'group_rename_page.dart';

/// Where the group sheet opens: its info, or straight on a second level.
enum GroupSheetLevel { info, add, rename }

/// The group sheet: info first, with "Add members" and "Rename group" as
/// second levels sliding in inside the same sheet ([SheetPageSwap]). The
/// surface is the CANVAS colour: its body is white grouped cards, which
/// separate from the canvas as they do on a page.
class GroupInfoSheet extends ConsumerStatefulWidget {
  const GroupInfoSheet({
    required this.groupId,
    this.initial = GroupSheetLevel.info,
    this.initialName = '',
    super.key,
  });
  final String groupId;

  /// The long-press menu opens straight on add or rename; back is the info.
  final GroupSheetLevel initial;

  /// Prefills the rename field when [initial] is rename.
  final String initialName;
  @override
  ConsumerState<GroupInfoSheet> createState() => _GroupInfoSheetState();
}

class _GroupInfoSheetState extends ConsumerState<GroupInfoSheet> {
  late GroupSheetLevel _level = widget.initial;
  bool _busy = false;
  late final _name = TextEditingController(text: widget.initialName);
  final _search = TextEditingController();
  final _picked = <String>{};

  /// Removed here until a fresh detail reflects it: a dismissed
  /// [Dismissible] still in the tree is an assertion.
  final _removed = <String>{};

  @override
  void dispose() {
    _name.dispose();
    _search.dispose();
    super.dispose();
  }

  /// The info page's height as it is left: the second levels are held to it,
  /// so a swap is a pure slide. `SheetPageSwap` snaps to the taller page and
  /// settles after, which read as a jump each way.
  final _infoKey = GlobalKey();
  double? _levelHeight;

  void _go(GroupSheetLevel level) => setState(() {
    if (_level == GroupSheetLevel.info) {
      _levelHeight = _infoKey.currentContext?.size?.height ?? _levelHeight;
    }
    _level = level;
    if (level == GroupSheetLevel.info) {
      _picked.clear();
      _search.clear();
    }
  });

  /// Runs one of the sheet's mutations; on success it lands back on the info.
  Future<void> _submit(Future<bool> Function() flow) async {
    if (_busy) return;
    setState(() => _busy = true);
    final ok = await flow();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) _go(GroupSheetLevel.info);
  }

  Future<void> _rename() => _submit(
    () => renameGroupFlow(
      context,
      groupId: widget.groupId,
      name: _name.text.trim(),
    ),
  );

  Future<void> _add() => _submit(() async {
    final ids = _picked.toList();
    final ok = await addMembersFlow(
      context,
      groupId: widget.groupId,
      userIds: ids,
    );
    // Re-added people come out of the removal mask at once.
    if (ok) _removed.removeAll(ids);
    return ok;
  });

  Future<bool> _remove(ChatGroupMember member) =>
      removeGroupMemberFlow(context, groupId: widget.groupId, member: member);

  Future<void> _leave() async {
    if (await leaveGroupFlow(context, ref, widget.groupId) && mounted) {
      Navigator.pop(context);
    }
  }

  Widget _page(ChatGroupDetail group) => switch (_level) {
    GroupSheetLevel.info => GroupInfoPage(
      key: _infoKey,
      group: group,
      selfId: ref.watch(currentSessionProvider)?.user.id,
      onAdd: () => _go(GroupSheetLevel.add),
      onRename: () {
        _name.text = group.name ?? '';
        _go(GroupSheetLevel.rename);
      },
      onRemove: _remove,
      // A long-press removal can land after the sheet is closed.
      onRemoved: (id) {
        if (mounted) setState(() => _removed.add(id));
      },
      onLeave: groupActionsFor(group).leave ? _leave : null,
    ),
    GroupSheetLevel.add => GroupAddPage(
      group: group,
      search: _search,
      selected: _picked,
      busy: _busy,
      onToggle:
          (id) => setState(
            () => _picked.contains(id) ? _picked.remove(id) : _picked.add(id),
          ),
      onBack: () => _go(GroupSheetLevel.info),
      onAdd: _add,
    ),
    GroupSheetLevel.rename => GroupRenamePage(
      controller: _name,
      busy: _busy,
      onBack: () => _go(GroupSheetLevel.info),
      onSave: _rename,
    ),
  };

  @override
  Widget build(BuildContext context) {
    ref.listen(chatGroupDetailProvider(widget.groupId), (_, next) {
      final members = next.valueOrNull?.members;
      // A fresh detail without them has caught up; drop the entry.
      _removed.removeWhere(
        (id) => !(members?.any((m) => m.userId == id) ?? true),
      );
    });
    return KalloSheetSurface(
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
                (_, __) => GroupDetailError(
                  onRetry:
                      () => ref.invalidate(
                        chatGroupDetailProvider(widget.groupId),
                      ),
                ),
            data:
                (group) => SheetPageSwap(
                  isSecondLevel: _level != GroupSheetLevel.info,
                  child: KeyedSubtree(
                    key: ValueKey(_level),
                    child: SizedBox(
                      height:
                          _level == GroupSheetLevel.info ? null : _levelHeight,
                      child: _page(group.withoutMembers(_removed)),
                    ),
                  ),
                ),
          ),
    );
  }
}
