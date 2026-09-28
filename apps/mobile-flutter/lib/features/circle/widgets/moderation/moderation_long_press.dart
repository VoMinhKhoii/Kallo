import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../models/social/moderation.dart';
import '../../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../logic/moderation_flows.dart';

enum _Action { report, block }

/// Long-press on someone else's post or reply → "Report …" and "Block
/// {name}", in the app's own anchored menu (the one the Log's sent messages
/// use). App Store 1.2 wants a way to report content where it is read; this
/// is it, and it draws nothing on the feed until someone asks for it.
///
/// The viewer's own content gets no menu — there is nobody to report — so
/// [isSelf] returns [child] untouched.
class ModerationLongPress extends ConsumerWidget {
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

  Future<void> _open(BuildContext context, WidgetRef ref) async {
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
    if (action == null || !context.mounted) return;
    switch (action) {
      case _Action.report:
        await reportFlow(
          context,
          ref,
          kind: kind,
          targetId: targetId,
          author: author,
        );
      case _Action.block:
        await blockFlow(context, ref, author);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isSelf) return child;
    return GestureDetector(
      // Alongside the post's own tap (it opens the thread): the long press
      // wins the arena at 500ms, the tap wins anything shorter.
      onLongPress: () => _open(context, ref),
      child: child,
    );
  }
}
