import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/menu/kallo_anchored_menu.dart';
import '../../../../shared/widgets/menu/kallo_hold_menu.dart';

enum _Action { edit, remove }

/// Press and hold a meal card: the card lifts, whole, over the blurred feed
/// with Edit and a destructive Remove / Discard beside it.
///
/// The app's own hold menu ([KalloHoldMenu]), the one a sent message opens —
/// same 500ms hold, same haptic, same lift (owner, 2026-11-05). It was
/// `CupertinoContextMenu` until then, which held for 800ms and sprang open on
/// an overshooting curve. The card still lifts WHOLE — the owner's ruling
/// (2026-10-22): a card half under the gauges or the composer is lifted out in
/// full, and one taller than the screen is scaled down to fit
/// (`anchored_menu_lift.dart`).
///
/// Taps still reach [child]: a plain tap resolves to the card's own gesture
/// (expand, open a dish), and only a held press opens the menu.
class MealHoldMenu extends StatelessWidget {
  const MealHoldMenu({
    super.key,
    required this.child,
    required this.removeLabel,
    this.onEdit,
    this.onRemove,
  });

  final Widget child;

  /// "Remove" on a saved meal, "Discard" on an unsaved one.
  final String removeLabel;

  /// Null drops the action from the menu.
  final VoidCallback? onEdit;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final actions = [
      if (onEdit != null)
        KalloMenuAction(
          label: 'logging.edit'.tr(),
          icon: LucideIcons.pencil300,
          value: _Action.edit,
        ),
      if (onRemove != null)
        KalloMenuAction(
          label: removeLabel,
          icon: LucideIcons.trash2300,
          value: _Action.remove,
          destructive: true,
        ),
    ];
    // The menu needs at least one action; a card with none is just the card.
    if (actions.isEmpty) return child;
    // The same actions as VoiceOver custom actions: a press-and-hold is not a
    // gesture a screen-reader user should have to discover, and Edit and
    // Remove used to be plain buttons in the row under the card.
    return Semantics(
      customSemanticsActions: {
        if (onEdit != null)
          CustomSemanticsAction(label: 'logging.edit'.tr()): onEdit!,
        if (onRemove != null)
          CustomSemanticsAction(label: removeLabel): onRemove!,
      },
      child: KalloHoldMenu<_Action>(
        actions: actions,
        onSelected:
            (action) => switch (action) {
              _Action.edit => onEdit?.call(),
              _Action.remove => onRemove?.call(),
            },
        child: child,
      ),
    );
  }
}
