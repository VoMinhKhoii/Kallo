import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show Material, MaterialType;
import 'package:flutter/semantics.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Press and hold a meal card: the card lifts, whole, over the blurred feed
/// with Edit and a destructive Remove / Discard under it.
///
/// The system's own context menu, not a hand-rolled one (the app's Cupertino
/// rule). It is also what keeps the lifted card WHOLE — the owner's ruling
/// (2026-10-22): a card half under the gauges or the composer is lifted out in
/// full, and one taller than the screen is scaled down to fit.
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
    final actions = <Widget>[
      if (onEdit != null)
        _action(
          context,
          label: 'logging.edit'.tr(),
          icon: LucideIcons.pencil300,
          run: onEdit!,
        ),
      if (onRemove != null)
        _action(
          context,
          label: removeLabel,
          icon: LucideIcons.trash2300,
          run: onRemove!,
          destructive: true,
        ),
    ];
    // The menu needs at least one action; a card with none is just the card.
    if (actions.isEmpty) return child;
    // The card is sized by the feed's width, which the menu's own preview does
    // not pass on — its default FittedBox lays the child out unbounded, and a
    // row with an Expanded name cannot. So the card keeps the width it has in
    // the feed and is FITTED: grown for the lift, and scaled down in the open
    // menu when it is taller than the screen allows, so it always shows whole.
    //
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
      child: LayoutBuilder(
        builder:
            (context, constraints) => CupertinoContextMenu.builder(
              enableHapticFeedback: true,
              actions: actions,
              builder:
                  (context, animation) => FittedBox(
                    fit: BoxFit.contain,
                    // The lifted copy is drawn in the menu's own route, above
                    // the page's Material — without one of its own, every Text
                    // in the card inherits Flutter's yellow "no Material"
                    // underline (seen on the simulator, 2026-10-23).
                    child: Material(
                      type: MaterialType.transparency,
                      child: SizedBox(
                        width: constraints.maxWidth,
                        child: child,
                      ),
                    ),
                  ),
            ),
      ),
    );
  }

  /// Closes the menu first, then acts a frame later. Acting in the SAME frame
  /// as the pop — pushing the confirm dialog or the edit sheet while the
  /// menu's route is starting to close — trips a framework semantics assertion
  /// (`computeChildGeometry`: a node whose parent is no longer its ancestor);
  /// the frame between them is what keeps it out. Reproduced by the
  /// "holding the card offers Edit and Discard" test.
  static Widget _action(
    BuildContext context, {
    required String label,
    required IconData icon,
    required VoidCallback run,
    bool destructive = false,
  }) => CupertinoContextMenuAction(
    isDestructiveAction: destructive,
    trailingIcon: icon,
    onPressed: () {
      Navigator.of(context, rootNavigator: true).pop();
      WidgetsBinding.instance.addPostFrameCallback((_) => run());
    },
    child: Text(label),
  );
}
