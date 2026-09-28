import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../models/social/moderation.dart';
import '../../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../data/local_blocks.dart';
import '../../logic/moderation_flows.dart';

enum _Action { report, block }

/// Long-press on someone else's post or reply → "Report …" and "Block
/// {name}", in the app's own anchored menu (the one the Log's sent messages
/// use). App Store 1.2 wants a way to report content where it is read; this
/// is it, and it draws nothing on the feed until someone asks for it.
///
/// The viewer's own content gets no menu — there is nobody to report — so
/// [isSelf] returns [child] untouched.
class ModerationLongPress extends ConsumerStatefulWidget {
  const ModerationLongPress({
    super.key,
    required this.kind,
    required this.targetId,
    required this.author,
    required this.isSelf,
    required this.child,
  });

  /// [ReportTargetKind.share] for a post, [ReportTargetKind.reply] for a
  /// reply.
  final ReportTargetKind kind;
  final String targetId;
  final CircleProfile author;
  final bool isSelf;
  final Widget child;

  @override
  ConsumerState<ModerationLongPress> createState() =>
      _ModerationLongPressState();
}

class _ModerationLongPressState extends ConsumerState<ModerationLongPress> {
  /// True from the long press until its flow ends. The reason sheet and the
  /// confirm close before their request is sent, so a slow report or block
  /// would otherwise leave the gesture live under it — and a second press
  /// would send the same POST again, spending the report and block routes'
  /// per-minute budgets.
  bool _busy = false;

  Future<void> _open() async {
    setState(() => _busy = true);
    try {
      await _run();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _run() async {
    final kind = widget.kind;
    final author = widget.author;
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || !box.hasSize || overlay == null) return;
    // The menu wants the rect in the ROOT overlay's coordinates.
    final anchor = box.localToGlobal(Offset.zero, ancestor: overlay) & box.size;
    final name = author.label;
    final action = await showKalloAnchoredMenu<_Action>(
      context,
      anchor: anchor,
      actions: [
        KalloMenuAction(
          label: tr(
            kind == ReportTargetKind.reply
                ? 'groups.moderation.reportReply'
                : 'groups.moderation.reportPost',
          ),
          icon: LucideIcons.flag300,
          value: _Action.report,
        ),
        KalloMenuAction(
          label: tr('groups.moderation.blockName', namedArgs: {'name': name}),
          icon: LucideIcons.ban300,
          value: _Action.block,
        ),
      ],
    );
    if (action == null || !mounted) return;
    switch (action) {
      case _Action.report:
        await reportFlow(
          context,
          ref,
          kind: kind,
          targetId: widget.targetId,
          author: author,
        );
      case _Action.block:
        await blockFlow(context, ref, author);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Nor does someone the viewer has just blocked: their content is leaving,
    // and a second "Block" would be refused.
    final blocked = ref.watch(
      locallyBlockedUserIdsProvider.select(
        (ids) => ids.contains(widget.author.userId),
      ),
    );
    if (widget.isSelf || blocked) return widget.child;
    return GestureDetector(
      // Alongside the post's own tap (it opens the thread): the long press
      // wins the arena at 500ms, the tap wins anything shorter.
      onLongPress: _busy ? null : _open,
      child: widget.child,
    );
  }
}
