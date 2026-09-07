import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'add_friend_sheet.dart';
import '../groups/create_group_sheet.dart';

Future<void> showCreateGroupSheet(BuildContext context) => showNhamSheet<void>(
  context,
  isScrollControlled: true,
  builder: (_) => const CreateGroupSheet(),
);

enum _AddAction { friend, group }

/// The Circle header's add control: one quiet 44pt icon button that opens an
/// ANCHORED POPOVER under itself — "Add a friend" / "Create a group".
///
/// Not a [CupertinoActionSheet] (what this was) and not a bottom sheet: those
/// both throw the chooser to the bottom of the screen, away from the control
/// that was tapped. A two-item menu hanging off its own button is the
/// ChatGPT-"+" idiom the canvas specifies — the card reads as an extension of
/// the button rather than a separate surface, and the eye never leaves the
/// corner it just touched.
///
/// The popover itself is [showKalloAnchoredMenu]. This file OWNED that route
/// until 2026-09-08 — the measured anchor rect, `showGeneralDialog`, the fade
/// + scale out of the aligned corner, the transparent [Material] over the
/// overlay — and the sent-message menu needed the same thing, so it moved to
/// `shared/widgets/menu/` and this became its first consumer. The rows changed
/// shape in the move: the shared card is 44pt with the glyph TRAILING, where
/// this drew 56pt [ListRow]s with it leading. One menu anatomy, app-wide,
/// beats two that only look alike.
class CircleAddMenu extends StatelessWidget {
  const CircleAddMenu({super.key});

  @override
  Widget build(BuildContext context) => Builder(
    builder: (buttonContext) => IconButton(
      tooltip: tr('groups.page.addFriend'),
      onPressed: () => _openMenu(buttonContext),
      // Pinned to the header's 44 slot: IconButton's own 48 default made this
      // 4pt wider than the leading slot, which pushed the title off centre.
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints.tightFor(width: 44, height: 44),
      icon: const Icon(
        LucideIcons.userPlus300,
        size: KalloIcons.size,
        color: kInk,
      ),
    ),
  );

  Future<void> _openMenu(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    // The root overlay: the same space the menu resolves its own geometry in.
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || overlay == null) return;
    final anchor = box.localToGlobal(Offset.zero, ancestor: overlay) & box.size;

    final action = await showKalloAnchoredMenu<_AddAction>(
      context,
      anchor: anchor,
      // Right edges flush with the button, which sits in the trailing slot.
      align: Alignment.topRight,
      actions: [
        KalloMenuAction(
          label: tr('groups.page.addFriend'),
          icon: LucideIcons.userPlus300,
          value: _AddAction.friend,
        ),
        KalloMenuAction(
          label: tr('groups.page.createGroup'),
          icon: LucideIcons.users300,
          value: _AddAction.group,
        ),
      ],
    );
    if (action == null || !context.mounted) return;
    switch (action) {
      case _AddAction.friend:
        await showAddFriendSheet(context);
      case _AddAction.group:
        await showCreateGroupSheet(context);
    }
  }
}
