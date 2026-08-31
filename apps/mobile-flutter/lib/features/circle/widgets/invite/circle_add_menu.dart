import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'add_friend_sheet.dart';
import '../groups/create_group_sheet.dart';

Future<void> showCreateGroupSheet(BuildContext context) => showNhamSheet<void>(
  context,
  isScrollControlled: true,
  builder: (_) => const CreateGroupSheet(),
);

enum _AddAction { friend, group }

/// Width of the popover card (native pass, 2026-08-31).
const double _menuWidth = 240;

/// Gap between the button's bottom edge and the card.
const double _menuGap = 8;

/// The popover's scrim — ink @ 20%, well short of the dialog's black/50. A
/// menu is an extension of the page it hangs off, so the page behind it stays
/// readable; a modal dialog is not, and dims it properly.
const Color _menuScrim = Color(0x33141413);

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
/// The card wears the app's grouped-card anatomy ([GroupedListCard] + 56pt
/// [ListRow]s, separator inset 36) so a menu row and a settings row are the
/// same object; it is TRUE elevation, so unlike an ordinary card it carries
/// [kCardShadows] over a light scrim.
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
    HapticFeedback.lightImpact(); // open cue, as everywhere else
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Navigator.of(context).overlay?.context.findRenderObject() as RenderBox?;
    if (box == null || overlay == null) return;
    final topLeft = box.localToGlobal(Offset.zero, ancestor: overlay);
    final anchor = topLeft & box.size;

    final action = await showGeneralDialog<_AddAction>(
      context: context,
      barrierDismissible: true,
      barrierLabel: tr('common.close'),
      barrierColor: _menuScrim,
      transitionDuration: KalloMotion.quick,
      pageBuilder: (_, __, ___) => const SizedBox.shrink(),
      transitionBuilder: (dialogContext, animation, _, __) => _AnchoredMenu(
        anchor: anchor,
        overlaySize: overlay.size,
        animation: animation,
        onPick: (picked) => Navigator.of(dialogContext).pop(picked),
      ),
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

/// The card itself, pinned under [anchor]'s bottom-right corner and growing
/// out of that corner.
class _AnchoredMenu extends StatelessWidget {
  const _AnchoredMenu({
    required this.anchor,
    required this.overlaySize,
    required this.animation,
    required this.onPick,
  });

  final Rect anchor;
  final Size overlaySize;
  final Animation<double> animation;
  final ValueChanged<_AddAction> onPick;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: animation, curve: KalloEase.enter);
    return Stack(
      children: [
        Positioned(
          top: anchor.bottom + _menuGap,
          // Right-aligned to the button, clamped so the card can never sit off
          // screen if the control ever moves inboard.
          right: (overlaySize.width - anchor.right).clamp(
            KalloSpacing.sp3,
            overlaySize.width - _menuWidth - KalloSpacing.sp3,
          ),
          width: _menuWidth,
          child: FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
              alignment: Alignment.topRight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(KalloRadii.card),
                  boxShadow: kCardShadows,
                ),
                child: GroupedListCard(
                  children: [
                    ListRow(
                      icon: LucideIcons.userPlus300,
                      label: tr('groups.page.addFriend'),
                      onTap: () => onPick(_AddAction.friend),
                    ),
                    ListRow(
                      icon: LucideIcons.users300,
                      label: tr('groups.page.createGroup'),
                      onTap: () => onPick(_AddAction.group),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
